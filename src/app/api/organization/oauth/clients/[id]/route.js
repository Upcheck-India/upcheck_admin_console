// /api/organization/oauth/clients/:id
//   GET    — one application (admin console)
//   PATCH  — edit metadata / redirect URIs / scopes, or suspend/activate
//   DELETE — revoke the application (cascade-revokes its grants & tokens)
//
// :id is the Mongo document id (falls back to matching clientId).
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../../lib/mongodb';
import { requireOAuthAdmin, capString } from '../../../../../../lib/oauth/auth';
import { actorFromUser, recordOAuthAudit, clientIpFrom } from '../../../../../../lib/oauth/audit';
import {
  validateRedirectUris,
  sanitizeAllowedScopes,
  sanitizeClient,
  CLIENT_STATUS,
} from '../../../../../../lib/oauth/clients';

export const dynamic = 'force-dynamic';

function clientQuery(id) {
  const or = [{ clientId: id }];
  if (ObjectId.isValid(id)) or.unshift({ _id: new ObjectId(id) });
  return { $or: or };
}

async function loadClient(db, id) {
  return db.collection('oauth_clients').findOne(clientQuery(id));
}

/** Revoke all active grants + tokens belonging to a client. */
async function cascadeRevoke(db, clientId) {
  const now = new Date();
  await Promise.all([
    db.collection('oauth_grants').updateMany({ clientId, status: 'active' }, { $set: { status: 'revoked', revokedAt: now } }),
    db.collection('oauth_access_tokens').updateMany({ clientId, revokedAt: null }, { $set: { revokedAt: now } }),
    db.collection('oauth_refresh_tokens').updateMany({ clientId, revokedAt: null }, { $set: { revokedAt: now } }),
  ]);
}

export async function GET(request, { params }) {
  try {
    const { response } = await requireOAuthAdmin(request);
    if (response) return response;
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db('resources');
    const doc = await loadClient(db, id);
    if (!doc) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    return NextResponse.json({ client: sanitizeClient(doc) });
  } catch (e) {
    console.error('GET oauth client error', e);
    return NextResponse.json({ error: 'Failed to load application' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { user, response } = await requireOAuthAdmin(request, { mutation: true });
    if (response) return response;
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db('resources');
    const doc = await loadClient(db, id);
    if (!doc) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const set = { updatedAt: new Date() };

    if (body?.name !== undefined) {
      const name = capString(body.name, 120);
      if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      set.name = name;
    }
    if (body?.description !== undefined) set.description = capString(body.description, 500);
    if (body?.ownerEmail !== undefined) set.ownerEmail = capString(body.ownerEmail, 200);
    if (body?.redirectUris !== undefined) {
      try {
        set.redirectUris = validateRedirectUris(body.redirectUris);
      } catch (err) {
        if (err && err.isOAuthError) return NextResponse.json({ error: err.description || err.message }, { status: err.status || 400 });
        throw err;
      }
    }
    if (body?.scopes !== undefined) {
      const scopes = sanitizeAllowedScopes(body.scopes);
      if (!scopes.length) return NextResponse.json({ error: 'Select at least one valid scope' }, { status: 400 });
      set.allowedScopes = scopes;
    }

    // Status change: only suspend/activate between verified states here.
    let statusChange = null;
    if (body?.status !== undefined) {
      const target = body.status;
      const current = doc.status;
      const allowed =
        (target === CLIENT_STATUS.SUSPENDED && current === CLIENT_STATUS.ACTIVE) ||
        (target === CLIENT_STATUS.ACTIVE && current === CLIENT_STATUS.SUSPENDED);
      if (!allowed) {
        return NextResponse.json(
          { error: `Cannot change status from '${current}' to '${target}' here` },
          { status: 400 }
        );
      }
      set.status = target;
      statusChange = target;
    }

    await db.collection('oauth_clients').updateOne({ _id: doc._id }, { $set: set });

    // Suspending must immediately stop access: cascade-revoke tokens/grants.
    if (statusChange === CLIENT_STATUS.SUSPENDED) {
      await cascadeRevoke(db, doc.clientId);
    }

    const actor = actorFromUser(user);
    await recordOAuthAudit(db, {
      action: statusChange ? `client.${statusChange === CLIENT_STATUS.SUSPENDED ? 'suspend' : 'activate'}` : 'client.update',
      clientId: doc.clientId,
      actor,
      ip: clientIpFrom(request),
      meta: { fields: Object.keys(set).filter((k) => k !== 'updatedAt') },
    });

    const updated = await loadClient(db, id);
    return NextResponse.json({ client: sanitizeClient(updated) });
  } catch (e) {
    console.error('PATCH oauth client error', e);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireOAuthAdmin(request, { mutation: true });
    if (response) return response;
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db('resources');
    const doc = await loadClient(db, id);
    if (!doc) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    await db.collection('oauth_clients').updateOne(
      { _id: doc._id },
      { $set: { status: CLIENT_STATUS.REVOKED, revokedAt: new Date(), updatedAt: new Date() } }
    );
    await cascadeRevoke(db, doc.clientId);

    await recordOAuthAudit(db, {
      action: 'client.revoke',
      clientId: doc.clientId,
      actor: actorFromUser(user),
      ip: clientIpFrom(request),
      meta: { name: doc.name },
    });
    return NextResponse.json({ revoked: true });
  } catch (e) {
    console.error('DELETE oauth client error', e);
    return NextResponse.json({ error: 'Failed to revoke application' }, { status: 500 });
  }
}
