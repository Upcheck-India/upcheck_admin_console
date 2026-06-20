import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Console admin';

    // 1. Fetch all other users
    const allUsers = await db.collection('admin_users').find(
      { _id: { $ne: currentUser._id }, messagingId: { $exists: true, $ne: null } },
      { projection: { _id: 1, username: 1, email: 1, name: 1, messagingId: 1, messagingPrivacy: 1, role: 1 } }
    ).toArray();

    // 2. Determine "teammates"
    // Fetch all projects current user is in
    const userProjects = await db.collection('projects').find({
      $or: [
        { superManager: currentUser.username },
        { 'members.user': currentUser.username }
      ]
    }).toArray();
    
    // Create a Set of teammate usernames
    const teammateUsernames = new Set();
    userProjects.forEach(project => {
      if (project.superManager) teammateUsernames.add(project.superManager);
      if (project.members) {
        project.members.forEach(m => teammateUsernames.add(m.user));
      }
    });

    // 3. Filter by privacy settings
    const discoverableUsers = allUsers.filter(user => {
      const privacy = user.messagingPrivacy || 'none';
      
      if (privacy === 'everyone') return true;
      if (privacy === 'none') return false;
      if (privacy === 'admins' && isAdmin) return true;
      if (privacy === 'teammates' && teammateUsernames.has(user.username)) return true;
      
      return false;
    });

    return NextResponse.json({
      users: discoverableUsers.map(u => ({
        id: u._id.toString(),
        username: u.username,
        email: u.email,
        name: u.name,
        messagingId: u.messagingId
      }))
    });
  } catch (err) {
    console.error('Discover error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
