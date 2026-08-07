// GET /api/organization/oauth/scopes
//
// The scope catalogue for the registration UI (admin console). Cookie-gated so
// only admins enumerate it here; the same list is also public via the protocol
// discovery document (/api/oauth/v1/metadata).
import { NextResponse } from 'next/server';
import { requireOAuthAdmin } from '../../../../../lib/oauth/auth';
import { SCOPES } from '../../../../../lib/oauth/scopes';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { response } = await requireOAuthAdmin(request);
  if (response) return response;
  return NextResponse.json({ scopes: SCOPES });
}
