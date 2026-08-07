// GET /api/oauth/v1/authorize/request?rid=...
//
// Backing data for the consent screen. Cookie-authenticated: only a portal admin
// (or a holder of api.manage) may view a pending authorization request and, in
// the sibling /decision route, approve it. Returns the app identity + the
// human-readable scopes being requested. Never returns anything sensitive.
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { requireOAuthAdmin } from '../../../../../../lib/oauth/auth';
import { getAuthRequest, findClient } from '../../../../../../lib/oauth/service';
import { getScope } from '../../../../../../lib/oauth/scopes';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { response } = await requireOAuthAdmin(request);
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const rid = searchParams.get('rid') || '';
    const client = await clientPromise;
    const db = client.db('resources');

    const req = await getAuthRequest(db, rid);
    if (!req) {
      return NextResponse.json({ error: 'not_found', error_description: 'Authorization request not found.' }, { status: 404 });
    }
    if (req.consumed) {
      return NextResponse.json({ error: 'already_decided', error_description: 'This authorization request has already been decided.' }, { status: 409 });
    }
    if (req.expired) {
      return NextResponse.json({ error: 'expired', error_description: 'This authorization request has expired. Please restart from the application.' }, { status: 410 });
    }

    const app = await findClient(db, req.clientId);
    if (!app) {
      return NextResponse.json({ error: 'not_found', error_description: 'The requesting application no longer exists.' }, { status: 404 });
    }

    return NextResponse.json({
      requestId: req.requestId,
      app: {
        name: app.name,
        description: app.description || '',
        homepageUrl: app.homepageUrl || '',
        logoUrl: app.logoUrl || '',
        isFirstParty: app.isFirstParty !== false,
      },
      redirectUri: req.redirectUri,
      scopes: (req.scopes || []).map((id) => {
        const s = getScope(id);
        return { id, label: s?.label || id, description: s?.description || '', resource: s?.resource || '' };
      }),
    });
  } catch (e) {
    console.error('GET /api/oauth/v1/authorize/request error', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
