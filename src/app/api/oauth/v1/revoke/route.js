// POST /api/oauth/v1/revoke  (RFC 7009)
//
// A client revokes one of its own access or refresh tokens. Revoking a refresh
// token also revokes the access tokens minted under the same grant. Per the RFC
// the endpoint returns 200 even for an unknown/invalid token, so callers cannot
// probe token validity here.
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { authenticateClient, extractClientCredentials, revokeToken } from '../../../../../lib/oauth/service';
import { oauthErrorResponse } from '../../../../../lib/oauth/errors';
import { recordOAuthAudit, clientIpFrom } from '../../../../../lib/oauth/audit';

export const dynamic = 'force-dynamic';

async function parseBody(request) {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return request.json().catch(() => ({}));
  try {
    const params = new URLSearchParams(await request.text());
    const obj = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    return obj;
  } catch {
    return {};
  }
}

export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');
    const body = await parseBody(request);
    const creds = extractClientCredentials(request, body);
    // A revoking client need not be "active" (a suspended app may still tidy up),
    // but it must prove its identity and not be revoked.
    const app = await authenticateClient(db, creds, { requireActive: false });
    await revokeToken(db, { client: app, token: body?.token || '' });
    await recordOAuthAudit(db, {
      action: 'token.revoke',
      clientId: app.clientId,
      ip: clientIpFrom(request),
      meta: { hint: body?.token_type_hint || null },
    });
    return NextResponse.json({ revoked: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return oauthErrorResponse(err);
  }
}
