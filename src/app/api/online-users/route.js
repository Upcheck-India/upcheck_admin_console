import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../lib/auth';

// GET /api/online-users
// Returns users whose lastHeartbeat is within the last 30 seconds. This must
// stay comfortably above upcheck_realtime's lastActiveBumpMs (15s as of this
// writing) — a connected user's heartbeat is only bumped that often, so a
// cutoff tighter than the bump interval would falsely report them offline
// for a chunk of every cycle.
export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids');
    const freshnessCutoff = new Date(Date.now() - 30000);

    let query = {};
    if (idsParam) {
      const idArray = idsParam.split(',').map(id => {
        try {
          return new ObjectId(id.trim());
        } catch {
          return null;
        }
      }).filter(Boolean);
      query = { _id: { $in: idArray } };
    } else {
      query = { lastHeartbeat: { $gte: freshnessCutoff } };
    }

    const online = await db
      .collection('admin_users')
      .find(query, { projection: { password: 0, sessionToken: 0 } })
      .toArray();

    // Authenticate scanner/logged-in user
    const auth = await getAuthUser(req);
    let myTeamIds = [];
    if (auth && auth.user) {
      const myId = auth.user._id;
      const myTeams = await db.collection('teams').find({
        $or: [
          { members: myId },
          { members: myId.toString() },
          { lead: myId },
          { lead: myId.toString() }
        ]
      }).toArray();
      myTeamIds = myTeams.map(t => t._id.toString());
    }

    const resolved = await Promise.all(online.map(async (u) => {
      let isTeammate = false;
      const uIdStr = u._id.toString();
      const myIdStr = auth?.user?._id?.toString();
      
      if (myIdStr && uIdStr === myIdStr) {
        isTeammate = true;
      } else if (myTeamIds.length > 0) {
        const targetTeams = await db.collection('teams').find({
          _id: { $in: myTeamIds.map(id => new ObjectId(id)) },
          $or: [
            { members: u._id },
            { members: uIdStr },
            { lead: u._id },
            { lead: uIdStr }
          ]
        }).limit(1).toArray();
        isTeammate = targetTeams.length > 0;
      }
      
      return {
        ...u,
        _id: uIdStr,
        isTeammate
      };
    }));

    return NextResponse.json(resolved);
  } catch (error) {
    console.error('Failed to fetch online users', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
