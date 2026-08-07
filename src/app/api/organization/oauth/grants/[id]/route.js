// DELETE /api/organization/oauth/grants/:id
//
// Revoke a connected application's grant (disconnect it). Immediately revokes the
// grant and all access/refresh tokens issued under it. :id is the grantId.
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { requireOAuthAdmin } from '../../../../../../lib/oauth/auth';
import { actorFromUser, recordOAuthAudit, clientIpFrom } from '../../../../../../lib/oauth/audit';

export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireOAuthAdmin(request, { mutation: true });
    if (response) return response;
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db('resources');

    const grant = await db.collection('oauth_grants').findOne({ grantId: id });
    if (!grant) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    const now = new Date();
    await Promise.all([
      db.collection('oauth_grants').updateOne({ grantId: id }, { $set: { status: 'revoked', revokedAt: now } }),
      db.collection('oauth_access_tokens').updateMany({ grantId: id, revokedAt: null }, { $set: { revokedAt: now } }),
      db.collection('oauth_refresh_tokens').updateMany({ grantId: id, revokedAt: null }, { $set: { revokedAt: now } }),
    ]);

    await recordOAuthAudit(db, {
      action: 'grant.revoke',
      clientId: grant.clientId,
      actor: actorFromUser(user),
      ip: clientIpFrom(request),
      meta: { grantId: id },
    });
    return NextResponse.json({ revoked: true });
  } catch (e) {
    console.error('DELETE oauth grant error', e);
    return NextResponse.json({ error: 'Failed to revoke grant' }, { status: 500 });
  }
}
