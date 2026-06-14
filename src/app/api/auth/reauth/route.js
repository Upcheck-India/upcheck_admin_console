// POST /api/auth/reauth
// Verifies the user's password and, on success, stamps a 10-minute re-auth
// window on their account so subsequent sensitive-action routes will pass.

import bcrypt from 'bcryptjs';
import { grantReauth, getSessionUserForReauth } from '../../../../lib/reauth';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function POST(request) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return json({ success: false, error: 'Password is required' }, 400);
    }

    const { user } = await getSessionUserForReauth({ username: 1 });

    if (!user) {
      return json({ success: false, error: 'Unauthorized', message: 'No active session' }, 401);
    }

    if (!user.password) {
      return json({ success: false, error: 'No password set for this account' }, 400);
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      // Generic delay to slow brute-force attempts on the re-auth endpoint.
      await new Promise(r => setTimeout(r, 600));
      return json({ success: false, error: 'Incorrect password' }, 401);
    }

    await grantReauth(user._id);

    return json({ success: true, message: 'Re-authentication successful', expiresInSeconds: 600 });
  } catch (error) {
    console.error('Reauth (password) error:', error);
    return json({ success: false, error: 'Internal server error' }, 500);
  }
}
