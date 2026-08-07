// GET /api/organization/oauth/grants
//
// Connected applications — the active grants (an app the org has authorized).
// Each row joins in the client's display name. Admin console only.
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { requireOAuthAdmin, parseLimit } from '../../../../../lib/oauth/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { response } = await requireOAuthAdmin(request);
    if (response) return response;
    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const includeRevoked = searchParams.get('includeRevoked') === 'true';
    const limit = parseLimit(searchParams.get('limit'), { def: 100, max: 500 });
    const query = includeRevoked ? {} : { status: 'active' };

    const grants = await db.collection('oauth_grants').find(query).sort({ updatedAt: -1 }).limit(limit).toArray();
    const clientIds = [...new Set(grants.map((g) => g.clientId))];
    const clients = await db
      .collection('oauth_clients')
      .find({ clientId: { $in: clientIds } }, { projection: { clientId: 1, name: 1, logoUrl: 1, status: 1 } })
      .toArray();
    const nameById = new Map(clients.map((c) => [c.clientId, c]));

    const data = grants.map((g) => ({
      grantId: g.grantId,
      clientId: g.clientId,
      appName: nameById.get(g.clientId)?.name || g.clientId,
      appStatus: nameById.get(g.clientId)?.status || 'unknown',
      scopes: g.scopes || [],
      status: g.status,
      approvedBy: g.approvedBy || null,
      createdAt: g.createdAt || null,
      updatedAt: g.updatedAt || null,
      lastUsedAt: g.lastUsedAt || null,
      revokedAt: g.revokedAt || null,
    }));
    return NextResponse.json({ grants: data });
  } catch (e) {
    console.error('GET oauth grants error', e);
    return NextResponse.json({ error: 'Failed to list connected applications' }, { status: 500 });
  }
}
