// GET /api/auth/webauthn/debug
// Returns the WebAuthn configuration that the server will use for registration
// and authentication. Only accessible to logged-in admins.
// Remove or gate behind NODE_ENV once the passkey flow is confirmed working.

import { cookies } from 'next/headers';
import clientPromise from '../../../../../lib/mongodb';
import { getRpId, getRpName, getExpectedOrigins } from '../../../../../lib/webauthn';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { email: 1, 'webauthn.credentials': 1 } }
    );

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rpId = getRpId();
    const rpName = getRpName();
    const expectedOrigins = getExpectedOrigins(request);
    const requestOrigin = request.headers.get('origin') || '(none)';
    const requestHost = request.headers.get('host') || '(none)';

    const credentials = (user.webauthn?.credentials || []).map(c => ({
      credentialID: c.credentialID,
      credentialIDLength: c.credentialID?.length,
      deviceName: c.deviceName,
      transports: c.transports,
      counter: c.counter,
      addedAt: c.addedAt,
    }));

    return new Response(
      JSON.stringify({
        rpId,
        rpName,
        expectedOrigins,
        requestOrigin,
        requestHost,
        nodeEnv: process.env.NODE_ENV,
        NEXT_PUBLIC_WEBAUTHN_RP_ID: process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || '(not set — using localhost fallback!)',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || '(not set)',
        user: user.email,
        registeredCredentials: credentials,
      }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
