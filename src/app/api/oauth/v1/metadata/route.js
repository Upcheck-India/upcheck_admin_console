// GET /api/oauth/v1/metadata
//
// Discovery document (RFC 8414-style) for "Upcheck ERP Data OAuth" v1. Lets a
// client auto-configure endpoints, supported scopes and capabilities. Public,
// cacheable, contains no secrets.
import { NextResponse } from 'next/server';
import { SCOPES, API_VERSION } from '../../../../../lib/oauth/scopes';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const base = `${origin}/api/oauth/${API_VERSION}`;
  return NextResponse.json(
    {
      service: 'Upcheck ERP Data OAuth',
      version: API_VERSION,
      issuer: origin,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      revocation_endpoint: `${base}/revoke`,
      introspection_endpoint: `${base}/introspect`,
      resource_base: `${origin}/api/data/${API_VERSION}`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      scopes_supported: SCOPES.map((s) => s.id),
      scope_details: SCOPES.map((s) => ({ id: s.id, label: s.label, description: s.description })),
      access_token_type: 'Bearer',
      documentation: `${origin}/organization/api/docs`,
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } }
  );
}
