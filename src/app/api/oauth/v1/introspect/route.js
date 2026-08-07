// POST /api/oauth/v1/introspect  (RFC 7662)
//
// A client asks whether one of its own tokens is currently active, and for its
// scope/expiry. Only the token's owning client (authenticated here) gets a
// meaningful answer; for anything it doesn't own we return { active:false } so
// the endpoint can't be used as a cross-client oracle.
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { authenticateClient, extractClientCredentials, introspectToken } from '../../../../../lib/oauth/service';
import { oauthErrorResponse } from '../../../../../lib/oauth/errors';

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
    const app = await authenticateClient(db, creds, { requireActive: false });
    const result = await introspectToken(db, { client: app, token: body?.token || '' });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return oauthErrorResponse(err);
  }
}
