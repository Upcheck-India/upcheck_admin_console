// POST /api/oauth/v1/authorize/decision
//
// The admin's approve/deny action on a pending authorization request. Cookie-
// authenticated + same-origin (CSRF) guarded. On approve we mint a single-use
// authorization code and return the client redirect URL (with code+state) for
// the consent page to navigate to. On deny we return the redirect URL carrying
// error=access_denied. The browser navigation (not a server 302) keeps this a
// clean fetch→navigate from the SPA consent screen.
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { requireOAuthAdmin } from '../../../../../../lib/oauth/auth';
import { actorFromUser, recordOAuthAudit, clientIpFrom } from '../../../../../../lib/oauth/audit';
import { getAuthRequest, approveAuthRequest, denyAuthRequest, buildRedirectUrl } from '../../../../../../lib/oauth/service';
import { OAUTH_ERROR, oauthErrorResponse } from '../../../../../../lib/oauth/errors';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { user, response } = await requireOAuthAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const rid = typeof body?.rid === 'string' ? body.rid : '';
    const decision = body?.decision === 'approve' ? 'approve' : 'deny';

    const client = await clientPromise;
    const db = client.db('resources');
    const actor = actorFromUser(user);
    const ip = clientIpFrom(request);

    const req = await getAuthRequest(db, rid);
    if (!req) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (req.consumed) return NextResponse.json({ error: 'already_decided' }, { status: 409 });
    if (req.expired) return NextResponse.json({ error: 'expired' }, { status: 410 });

    if (decision === 'deny') {
      const { redirectUri, state } = await denyAuthRequest(db, rid, { actor });
      await recordOAuthAudit(db, { action: 'consent.deny', clientId: req.clientId, actor, ip, meta: { scopes: req.scopes } });
      return NextResponse.json({
        redirect: buildRedirectUrl(redirectUri, { error: OAUTH_ERROR.ACCESS_DENIED, error_description: 'The user denied the request.', state }),
      });
    }

    const { code, redirectUri, state } = await approveAuthRequest(db, rid, { actor });
    await recordOAuthAudit(db, { action: 'consent.approve', clientId: req.clientId, actor, ip, meta: { scopes: req.scopes } });
    return NextResponse.json({ redirect: buildRedirectUrl(redirectUri, { code, state }) });
  } catch (e) {
    return oauthErrorResponse(e);
  }
}
