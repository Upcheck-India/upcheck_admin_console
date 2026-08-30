import { NextResponse } from 'next/server';
import { withDataroomAuth, ADMIN_ROLES } from '../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/org-users - Get organizational users for permission assignment
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const filter = {};
    
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      filter.role = role;
    }

    const users = await db.collection('admin_users')
      .find(filter)
      .project({ _id: 1, username: 1, email: 1, role: 1, department: 1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      users,
      count: users.length,
    });
  },
  {
    roles: ADMIN_ROLES,
  },
);
