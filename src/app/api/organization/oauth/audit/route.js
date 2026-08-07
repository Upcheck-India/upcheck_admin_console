// GET /api/organization/oauth/audit
//
// Paginated view of the append-only OAuth audit log (register/verify/consent/
// token/revoke/etc.). Admin console only. Optional ?clientId= and ?action= filters.
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { requireOAuthAdmin, parseLimit, capString } from '../../../../../lib/oauth/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { response } = await requireOAuthAdmin(request);
    if (response) return response;
    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'), { def: 100, max: 500 });
    const query = {};
    const clientId = capString(searchParams.get('clientId'), 100);
    if (clientId) query.clientId = clientId;
    const action = capString(searchParams.get('action'), 60);
    if (action) query.action = action;

    const entries = await db.collection('oauth_audit_log').find(query).sort({ at: -1 }).limit(limit).toArray();
    return NextResponse.json({
      entries: entries.map((e) => ({
        id: String(e._id),
        action: e.action,
        clientId: e.clientId || null,
        actor: e.actor || null,
        ok: e.ok !== false,
        ip: e.ip || null,
        meta: e.meta || null,
        at: e.at || null,
      })),
    });
  } catch (e) {
    console.error('GET oauth audit error', e);
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
