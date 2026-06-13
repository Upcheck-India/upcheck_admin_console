import clientPromise from '../../../../../lib/mongodb';
import { hashCode, normalizeCode } from '../../../../../lib/backupCodes';
import { issueAdminSessionToken, setAdminSessionCookie } from '../../../../../lib/adminSession';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Log in with a single-use backup code. Used as a recovery factor when a
// passkey / trusted device is unavailable. On success the code is consumed and
// a normal admin session is established.
export async function POST(request) {
  try {
    const { username, code } = await request.json();

    if (!username || !code) {
      return json({ success: false, error: 'Username and backup code are required' }, 400);
    }

    if (normalizeCode(code).length < 8) {
      return json({ success: false, error: 'Invalid backup code' }, 400);
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne(
      { username: String(username).trim() },
      { projection: { backupCodes: 1, email: 1, name: 1, role: 1, username: 1 } }
    );

    const hashed = hashCode(code);
    const match = user?.backupCodes?.find(c => c.hash === hashed && !c.used);

    // Generic error to avoid revealing whether the username or the code was wrong.
    if (!user || !match) {
      return json({ success: false, error: 'Invalid backup code' }, 401);
    }

    // Consume the code (mark used) atomically.
    const now = new Date();
    const result = await db.collection('admin_users').updateOne(
      { _id: user._id, 'backupCodes.hash': hashed, 'backupCodes.used': false },
      { $set: { 'backupCodes.$.used': true, 'backupCodes.$.usedAt': now } }
    );

    if (result.modifiedCount === 0) {
      // The code was used concurrently between the read and the update.
      return json({ success: false, error: 'Invalid backup code' }, 401);
    }

    const sessionToken = await issueAdminSessionToken(db, user._id);
    await setAdminSessionCookie(sessionToken);

    const remaining = (user.backupCodes || []).filter(c => !c.used).length - 1;

    return json({
      success: true,
      message: 'Authentication successful',
      remaining,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Backup code verification error:', error);
    return json({ success: false, error: 'Internal server error' }, 500);
  }
}
