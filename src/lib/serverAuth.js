// Shared server-side auth helpers for internal (admin_token) routes.
// Derives the current user from the httpOnly `admin_token` cookie by looking up
// the matching sessionToken in the admin_users collection. This is preferred
// over trusting client-sent x-user-* headers.
import { NextResponse } from 'next/server';
import clientPromise from './mongodb';

export const ROLES_HIERARCHY = {
  'Console admin': ['Admin', 'Member', 'Intern'],
  'Admin': ['Member', 'Intern'],
  'Member': [],
  'Intern': [],
};

export function isAdminRole(role) {
  return role === 'Admin' || role === 'Console admin';
}

// Permission to administer other people's HR records (view everyone's data,
// approve/reject requests, manage shared config like leave types/holidays).
// Granted to Console admins unconditionally, or anyone holding the
// `users.manage` permission. This is the canonical HR management gate and
// should be preferred over role-only checks.
export function canManageUsers(user) {
  if (!user) return false;
  if (user.role === 'Console admin') return true;
  return Array.isArray(user.perms) && user.perms.includes('users.manage');
}

// Returns the authenticated user document (without password) or null.
export async function getAuthUser(req) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) return null;
  const client = await clientPromise;
  const db = client.db('resources');
  const user = await db
    .collection('admin_users')
    .findOne({ sessionToken: token }, { projection: { password: 0 } });
  return user || null;
}

// Convenience wrapper that returns { user, db, client } or an error response.
export async function requireAuth(req) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const client = await clientPromise;
  const db = client.db('resources');
  const user = await db
    .collection('admin_users')
    .findOne({ sessionToken: token }, { projection: { password: 0 } });
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, db, client };
}

// Requires the user to be Admin or Console admin.
export async function requireAdmin(req) {
  const result = await requireAuth(req);
  if (result.error) return result;
  if (!isAdminRole(result.user.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return result;
}

// Requires HR management rights: Console admin role or the `users.manage`
// permission. Use this for endpoints that act on other users' HR data.
export async function requireManageUsers(req) {
  const result = await requireAuth(req);
  if (result.error) return result;
  if (!canManageUsers(result.user)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return result;
}

// Append an entry to the shared user_activity_logs collection.
export async function logActivity(db, { action, actor, targetType = 'hr', targetId = null, targetName = '', metadata = {} }) {
  try {
    await db.collection('user_activity_logs').insertOne({
      action,
      targetType,
      targetId: targetId ? String(targetId) : null,
      targetName,
      actorId: actor?._id ? String(actor._id) : null,
      actorUsername: actor?.username || 'system',
      timestamp: new Date(),
      metadata,
    });
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
}
