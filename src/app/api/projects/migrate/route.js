import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

// GET - Run a one-time migration to assign a superManager to projects that are missing one.
export async function GET(req) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized. Please log in to run the migration.' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Invalid session token.' }, { status: 401 });
    }

    const projectsCollection = db.collection('projects');

    // Step 1: Correct the role for super managers who are already in the members list.
    const updateRoleFilter = {
      superManager: user.username,
      'members.user': user.username,
      'members.role': { $ne: 'Super Manager' }
    };
    const updateRoleDoc = {
      $set: { 'members.$.role': 'Super Manager', updatedAt: new Date() }
    };
    const roleUpdateResult = await projectsCollection.updateMany(updateRoleFilter, updateRoleDoc);

    // Step 2: Add the super manager to the members list if they are missing.
    const addMemberFilter = {
      superManager: user.username,
      'members.user': { $ne: user.username }
    };
    const addMemberDoc = {
      $push: { members: { user: user.username, role: 'Super Manager' } },
      $set: { updatedAt: new Date() }
    };
    const memberAddResult = await projectsCollection.updateMany(addMemberFilter, addMemberDoc);

    return NextResponse.json({
      message: 'Migration complete. All projects now have a consistent Super Manager role.',
      rolesCorrected: roleUpdateResult.modifiedCount,
      managersAddedToMembers: memberAddResult.modifiedCount,
    });

  } catch (error) {
    console.error('Error during project migration:', error);
    return NextResponse.json({ error: 'Migration failed. Check server logs for details.' }, { status: 500 });
  }
}
