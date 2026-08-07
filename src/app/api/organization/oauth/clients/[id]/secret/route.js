// POST /api/organization/oauth/clients/:id/secret
//
// Rotate an application's client secret. The new plaintext is returned ONCE and
// only its fingerprint is stored. Existing access/refresh tokens remain valid
// until they expire (they are bearer tokens, independent of the client secret);
// only NEW token requests must use the new secret. To also cut existing access,
// suspend the app or revoke its grants.
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../../../lib/mongodb';
import { requireOAuthAdmin } from '../../../../../../../lib/oauth/auth';
import { actorFromUser, recordOAuthAudit, clientIpFrom } from '../../../../../../../lib/oauth/audit';
import { sanitizeClient } from '../../../../../../../lib/oauth/clients';
import { generateClientSecret, fingerprint, secretHint } from '../../../../../../../lib/oauth/crypto';

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

    const newSecret = generateClientSecret();
    await db.collection('oauth_clients').updateOne(
      { _id: doc._id },
      { $set: { clientSecretHash: fingerprint(newSecret), secretLast4: secretHint(newSecret), secretRotatedAt: new Date(), updatedAt: new Date() } }
    );
    await recordOAuthAudit(db, {
      action: 'client.secret_rotate',
      clientId: doc.clientId,
      actor: actorFromUser(user),
      ip: clientIpFrom(request),
    });

    const updated = await db.collection('oauth_clients').findOne({ _id: doc._id });
    return NextResponse.json({ client: sanitizeClient(updated, { plaintextSecret: newSecret }) });
  } catch (e) {
    console.error('POST oauth client secret rotate error', e);
    return NextResponse.json({ error: 'Failed to rotate secret' }, { status: 500 });
  }
}
