// GET /api/data/v1/me
//
// Token-context endpoint: given a valid bearer token, returns the connected
// application, the granted scopes, and token expiry. Handy for a client to
// confirm what it can access. Requires any valid token; no specific scope.
import { requireToken, dataResponse } from '../../../../../lib/oauth/resource';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { ctx, response } = await requireToken(request);
  if (response) return response;
  return dataResponse({
    client: {
      clientId: ctx.client.clientId,
      name: ctx.client.name,
    },
    scopes: ctx.scopes,
    token: {
      expiresAt: ctx.token.expiresAt ? new Date(ctx.token.expiresAt).toISOString() : null,
    },
    apiVersion: 'v1',
  });
}
