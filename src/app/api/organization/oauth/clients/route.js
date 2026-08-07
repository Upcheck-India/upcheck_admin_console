// /api/organization/oauth/clients
//   GET  — list registered applications (admin console)
//   POST — register a new application (returns the client secret ONCE)
//
// Cookie-authenticated admin surface (requireOAuthAdmin). Registration creates a
// client in `pending` status; it cannot obtain tokens until an admin verifies it
// (see clients/[id]/verify).
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { requireOAuthAdmin, capString } from '../../../../../lib/oauth/auth';
import { actorFromUser, recordOAuthAudit, clientIpFrom } from '../../../../../lib/oauth/audit';
import {
  validateRedirectUris,
  sanitizeAllowedScopes,
  sanitizeClient,
  CLIENT_STATUS,
} from '../../../../../lib/oauth/clients';
import { generateClientId, generateClientSecret, fingerprint, secretHint } from '../../../../../lib/oauth/crypto';

export const dynamic = 'force-dynamic';

function badRequest(err) {
  if (err && err.isOAuthError) {
    return NextResponse.json({ error: err.description || err.message }, { status: err.status || 400 });
  }
  return null;
}

// Optional URL fields (homepage / logo) — validated but not required.
function optionalUrl(raw, label) {
  const v = capString(raw, 2000);
  if (!v) return '';
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad');
    return u.href;
  } catch {
    const e = new Error(`${label} must be a valid URL`);
    e.isOAuthError = true;
    e.status = 400;
    e.description = e.message;
    throw e;
  }
}

export async function GET(request) {
  try {
    const { response } = await requireOAuthAdmin(request);
    if (response) return response;
    const client = await clientPromise;
    const db = client.db('resources');
    const docs = await db.collection('oauth_clients').find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({ clients: docs.map((d) => sanitizeClient(d)) });
  } catch (e) {
    console.error('GET /api/organization/oauth/clients error', e);
    return NextResponse.json({ error: 'Failed to list applications' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requireOAuthAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const name = capString(body?.name, 120);
    if (!name) return NextResponse.json({ error: 'Application name is required' }, { status: 400 });

    let redirectUris;
    let homepageUrl;
    let logoUrl;
    try {
      redirectUris = validateRedirectUris(body?.redirectUris);
      homepageUrl = optionalUrl(body?.homepageUrl, 'Homepage URL');
      logoUrl = optionalUrl(body?.logoUrl, 'Logo URL');
    } catch (err) {
      const br = badRequest(err);
      if (br) return br;
      throw err;
    }

    const allowedScopes = sanitizeAllowedScopes(body?.scopes);
    if (!allowedScopes.length) {
      return NextResponse.json({ error: 'Select at least one valid scope' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const actor = actorFromUser(user);

    const clientId = generateClientId();
    const clientSecret = generateClientSecret();
    const now = new Date();
    const doc = {
      clientId,
      clientSecretHash: fingerprint(clientSecret),
      secretLast4: secretHint(clientSecret),
      name,
      description: capString(body?.description, 500),
      homepageUrl,
      logoUrl,
      ownerEmail: capString(body?.ownerEmail, 200),
      redirectUris,
      allowedScopes,
      grantTypes: ['authorization_code', 'refresh_token'],
      isFirstParty: body?.isFirstParty !== false,
      status: CLIENT_STATUS.PENDING,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    const res = await db.collection('oauth_clients').insertOne(doc);

    await recordOAuthAudit(db, {
      action: 'client.register',
      clientId,
      actor,
      ip: clientIpFrom(request),
      meta: { name, scopes: allowedScopes, redirectUris },
    });

    // The plaintext secret is returned exactly once here and never stored.
    return NextResponse.json(
      { client: sanitizeClient({ _id: res.insertedId, ...doc }, { plaintextSecret: clientSecret }) },
      { status: 201 }
    );
  } catch (e) {
    console.error('POST /api/organization/oauth/clients error', e);
    return NextResponse.json({ error: 'Failed to register application' }, { status: 500 });
  }
}
