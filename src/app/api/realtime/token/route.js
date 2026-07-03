import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { signRealtimeToken, TOKEN_TTL_SECONDS } from '../../../../lib/realtimeToken';

// POST /api/realtime/token
// Authenticated exactly like every other route (admin_token cookie or Bearer).
// Returns a short-lived JWT the client passes to the realtime Socket.IO server
// as io(url, { auth: { token } }). Clients should refresh before expiry
// (e.g. every ~8 min) and on reconnect.
export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = auth;

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
