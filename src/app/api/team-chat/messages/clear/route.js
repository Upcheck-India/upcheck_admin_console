import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../../../lib/auth.js';

export async function POST(request) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = authData.user;
    const db = authData.db;

    const { teamId, forEveryone } = await request.json();
    if (!teamId || !ObjectId.isValid(teamId)) {
      return NextResponse.json({ error: 'Invalid teamId' }, { status: 400 });
    }

    const userIdStr = currentUser._id.toString();

    // Verify membership
    const team = await db.collection('teams').findOne({
      _id: new ObjectId(teamId),
      $or: [
        { members: userIdStr },
        { lead: userIdStr },
        { members: currentUser._id },
        { lead: currentUser._id },
      ],
    });
    if (!team) return NextResponse.json({ error: 'Not a team member' }, { status: 403 });

    if (forEveryone) {
      // Only team lead or Admin can clear chat for everyone
      const isLead = team.lead?.toString() === userIdStr;
      const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Console admin';
      if (!isLead && !isAdmin) {
        return NextResponse.json({ error: 'Only team lead or admins can clear chat for everyone' }, { status: 403 });
      }

      // Mark all messages in the team as deleted for everyone
      await db.collection('team_messages').updateMany(
        { teamId },
        { $set: { deletedForEveryone: true, updatedAt: new Date() } }
      );
    } else {
      // Clear for me: add user's ID to deletedFor array of all messages in this team
      await db.collection('team_messages').updateMany(
        { teamId },
        { $addToSet: { deletedFor: userIdStr } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Clear chat error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
