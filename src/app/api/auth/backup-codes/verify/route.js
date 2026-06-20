// POST /api/auth/backup-codes/verify
// Log in with a single-use backup code. Used as a recovery factor when a
// passkey / password sign-in is unavailable. On success the code is consumed
// and a normal admin session is established.
//
// Rate limiting: max 5 failed attempts per username per 15-minute window.
// Attempts are tracked in a lightweight `backup_code_attempts` collection.
// Successful logins clear the attempt counter for that username.

import clientPromise from '../../../../../lib/mongodb';
import { hashCode, normalizeCode } from '../../../../../lib/backupCodes';
import { issueAdminSessionToken, setAdminSessionCookie } from '../../../../../lib/adminSession';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function checkRateLimit(db, username) {
  const key = String(username).toLowerCase().trim();
  const windowStart = new Date(Date.now() - WINDOW_MS);

  // Count failed attempts in the current window.
  const record = await db.collection('backup_code_attempts').findOne({ username: key });

  if (record && record.lockedUntil && new Date(record.lockedUntil) > new Date()) {
    const remaining = Math.ceil((new Date(record.lockedUntil) - Date.now()) / 1000);
    return {
      allowed: false,
      message: `Too many failed attempts. Try again in ${Math.ceil(remaining / 60)} minute(s).`,
      retryAfterSeconds: remaining,
    };
  }

  // Prune old attempts outside the current window.
  const recentAttempts = (record?.attempts || []).filter(
    t => new Date(t) > windowStart
  );

  if (recentAttempts.length >= MAX_ATTEMPTS) {
    // Lock the account out for the rest of the window.
    const lockedUntil = new Date(Date.now() + WINDOW_MS);
    await db.collection('backup_code_attempts').updateOne(
      { username: key },
      { $set: { lockedUntil, attempts: recentAttempts } },
      { upsert: true }
    );
    return {
      allowed: false,
      message: `Too many failed attempts. Account locked for 15 minutes.`,
      retryAfterSeconds: WINDOW_MS / 1000,
    };
  }

  return { allowed: true, recentAttempts, key };
}

async function recordFailedAttempt(db, key, recentAttempts) {
  const updated = [...(recentAttempts || []), new Date()];
  await db.collection('backup_code_attempts').updateOne(
    { username: key },
    { $set: { attempts: updated, lockedUntil: null } },
    { upsert: true }
  );
}

async function clearAttempts(db, key) {
  await db.collection('backup_code_attempts').deleteOne({ username: key });
}

export async function POST(request) {
  try {
    const { username, code } = await request.json();

    if (!username || !code) {
      return json({ success: false, error: 'Username and backup code are required' }, 400);
    }

    const normalized = normalizeCode(code);
    if (normalized.length < 8) {
      return json({ success: false, error: 'Invalid backup code format' }, 400);
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Ensure the attempts collection has a TTL index (created once, idempotent).
    try {
      await db.collection('backup_code_attempts').createIndex(
        { updatedAt: 1 },
        { expireAfterSeconds: 3600, background: true }
      );
    } catch { /* index already exists */ }

    // ── Rate limit check ─────────────────────────────────────────────────────
    const limit = await checkRateLimit(db, username);
    if (!limit.allowed) {
      return json(
        { success: false, error: 'Rate limited', message: limit.message },
        429
      );
    }

    // ── Credential lookup ─────────────────────────────────────────────────────
    const escapedUsername = String(username).trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const usernameRegex = new RegExp("^" + escapedUsername + "$", "i");
    const user = await db.collection('admin_users').findOne(
      { 
        $or: [
          { username: String(username).trim() },
          { username: { $regex: usernameRegex } }
        ]
      },
      { projection: { backupCodes: 1, email: 1, name: 1, role: 1, username: 1 } }
    );

    const hashed = hashCode(code);
    const match = user?.backupCodes?.find(c => c.hash === hashed && !c.used);

    if (!user || !match) {
      // Record the failure; use a constant-time-ish response to avoid user/code enumeration.
      await recordFailedAttempt(db, limit.key, limit.recentAttempts);
      const attemptsLeft = MAX_ATTEMPTS - (limit.recentAttempts?.length ?? 0) - 1;
      return json({
        success: false,
        error: 'Invalid backup code',
        attemptsRemaining: Math.max(0, attemptsLeft),
      }, 401);
    }

    // ── Consume the code atomically ───────────────────────────────────────────
    const now = new Date();
    const result = await db.collection('admin_users').updateOne(
      { _id: user._id, 'backupCodes.hash': hashed, 'backupCodes.used': false },
      { $set: { 'backupCodes.$.used': true, 'backupCodes.$.usedAt': now } }
    );

    if (result.modifiedCount === 0) {
      // Concurrent use — treat as invalid.
      await recordFailedAttempt(db, limit.key, limit.recentAttempts);
      return json({ success: false, error: 'Invalid backup code' }, 401);
    }

    // ── Success — clear the rate-limit record ─────────────────────────────────
    await clearAttempts(db, limit.key);

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
