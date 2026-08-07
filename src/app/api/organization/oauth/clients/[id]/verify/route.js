// POST /api/organization/oauth/clients/:id/verify
//
// An admin verifies a `pending` application, moving it to `active` so it can
// begin the authorization flow and obtain tokens. This is the human gate that
// keeps unverified apps out of the ecosystem.
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../../../lib/mongodb';
import { requireOAuthAdmin } from '../../../../../../../lib/oauth/auth';
import { actorFromUser, recordOAuthAudit, clientIpFrom } from '../../../../../../../lib/oauth/audit';
import { sanitizeClient, CLIENT_STATUS } from '../../../../../../../lib/oauth/clients';

export const dynamic = 'force-dynamic';

function clientQuery(id) {
  const or = [{ clientId: id }];
  if (ObjectId.isValid(id)) or.unshift({ _id: new ObjectId(id) });
  return { $or: or };
}

export async function POST(request, { params }) {
  try {
    const { user, response } = await requireOAuthAdmin(request, { mutation: true });
    if (response) return response;
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db('resources');
    const doc = await db.collection('oauth_clients').findOne(clientQuery(id));
    if (!doc) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    if (doc.status === CLIENT_STATUS.ACTIVE) {
      return NextResponse.json({ client: sanitizeClient(doc) });
    }
    if (doc.status !== CLIENT_STATUS.PENDING) {
      return NextResponse.json(
        { error: `Only pending applications can be verified (this one is '${doc.status}')` },
        { status: 400 }
      );
    }

    const actor = actorFromUser(user);
    await db.collection('oauth_clients').updateOne(
      { _id: doc._id },
      { $set: { status: CLIENT_STATUS.ACTIVE, verifiedBy: actor, verifiedAt: new Date(), updatedAt: new Date() } }
    );
    await recordOAuthAudit(db, {
      action: 'client.verify',
      clientId: doc.clientId,
      actor,
      ip: clientIpFrom(request),
      meta: { name: doc.name },
    });

    const updated = await db.collection('oauth_clients').findOne({ _id: doc._id });
    return NextResponse.json({ client: sanitizeClient(updated) });
  } catch (e) {
    console.error('POST oauth client verify error', e);
    return NextResponse.json({ error: 'Failed to verify application' }, { status: 500 });
  }
}
