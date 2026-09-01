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
    // My teams, once. The documents already contain their own member and lead
    // lists, so who my teammates are is answerable from these in memory —
    // it was previously re-queried against the teams collection once per
    // online user, turning a status poll into N+1 round trips for an answer
    // already sitting in `myTeams`.
    const teammateIds = new Set();
    const myIdStr = auth?.user?._id?.toString();
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
      for (const t of myTeams) {
        for (const m of (Array.isArray(t.members) ? t.members : [])) {
          if (m) teammateIds.add(m.toString());
        }
        // `lead` may be a single id or an array, and is stored as an ObjectId
        // in some documents and a string in others — same tolerance the query
        // above had to have.
        for (const l of (Array.isArray(t.lead) ? t.lead : [t.lead])) {
          if (l) teammateIds.add(l.toString());
        }
      }
    }

    const resolved = online.map((u) => {
      const uIdStr = u._id.toString();
      return {
        ...u,
        _id: uIdStr,
        isTeammate: (myIdStr && uIdStr === myIdStr) || teammateIds.has(uIdStr),
      };
    });

    return NextResponse.json(resolved);
  } catch (error) {
    console.error('Failed to fetch online users', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
