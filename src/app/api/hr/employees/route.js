import { NextResponse } from 'next/server';
import { requireAuth, canManageUsers } from '../../../../lib/serverAuth';

// GET - lightweight employee directory for pickers (managers only).
// Regular users don't need this; they only act on their own record.
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  if (!canManageUsers(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();
  const query = {};
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
    ];
  }

  const employees = await db.collection('admin_users')
    .find(query)
    .project({ username: 1, email: 1, firstName: 1, lastName: 1, role: 1, department: 1, jobTitle: 1 })
    .sort({ firstName: 1, username: 1 })
    .limit(500)
    .toArray();

  return NextResponse.json({ employees });
}
