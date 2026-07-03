import { NextResponse } from 'next/server';
import { getAuthUserResult } from '../../../../lib/auth';
import { signRealtimeToken, TOKEN_TTL_SECONDS } from '../../../../lib/realtimeToken';

// POST /api/realtime/token
// Authenticated exactly like every other route (admin_token cookie or Bearer).
// Returns a short-lived JWT the client passes to the realtime Socket.IO server
// as io(url, { auth: { token } }). Clients should refresh before expiry
// (e.g. every ~8 min) and on reconnect.
export async function POST(request) {
  try {
    const authResult = await getAuthUserResult(request);
    if (authResult.status === 'db_unavailable') {
      // Transient DB issue — NOT an auth failure. 503 so the client retries
      // without treating it as an invalid session (no logout).
      return NextResponse.json({ error: 'Auth temporarily unavailable' }, { status: 503 });
    }
    if (authResult.status !== 'ok') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = authResult;

    let token;
    try {
      token = signRealtimeToken({
        userId: user._id.toString(),
        username: user.username || null,
      });
    } catch (e) {
      // Misconfigured secret — surface clearly so the client falls back to
      // polling rather than retrying a broken handshake forever.
      console.error('Realtime token signing failed:', e.message);
      return NextResponse.json(
        { error: 'Realtime transport not configured' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      token,
      expiresIn: TOKEN_TTL_SECONDS,
      userId: user._id.toString(),
    });
  } catch (err) {
    console.error('Realtime token error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
