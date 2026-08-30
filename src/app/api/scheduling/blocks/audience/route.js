import { NextResponse } from 'next/server';
import { requireAuth, ROLES_HIERARCHY } from '../../../../../lib/serverAuth';
import { displayName } from '../../../../../lib/scheduleClaimStore';

// GET /api/scheduling/blocks/audience — the directory the "who can claim"
// picker offers: roles, teams, and people. Names only; no HR data leaves here.
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db } = auth;

  try {
    const [users, teams] = await Promise.all([
      db.collection('admin_users').find(
        { employmentStatus: { $ne: 'terminated' } },
        { projection: { firstName: 1, lastName: 1, username: 1, name: 1, email: 1, role: 1 } },
      ).limit(1000).toArray(),
      db.collection('teams').find({}, { projection: { name: 1 } }).limit(500).toArray(),
    ]);

    return NextResponse.json({
      roles: Object.keys(ROLES_HIERARCHY),
      teams: teams.map((t) => ({ _id: String(t._id), name: t.name || 'Untitled team' })),
      users: users
        .map((u) => ({ _id: String(u._id), name: displayName(u), email: u.email || '', role: u.role || '' }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (e) {
    console.error('blocks/audience GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
