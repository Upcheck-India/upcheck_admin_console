import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../../lib/auth';
import { getStatusPrivacy, setStatusPrivacy, PRIVACY_MODES } from '../../../../lib/status/privacy';

async function resolveForDisplay(db, privacy) {
  const [teams, users] = await Promise.all([
    privacy.teamIds.length > 0
      ? db.collection('teams')
          .find({ _id: { $in: privacy.teamIds.map((id) => new ObjectId(id)) } }, { projection: { name: 1 } })
          .toArray()
      : [],
    privacy.userIds.length > 0
      ? db.collection('admin_users')
          .find({ _id: { $in: privacy.userIds.map((id) => new ObjectId(id)) } }, { projection: { username: 1, name: 1, avatar: 1 } })
          .toArray()
      : [],
  ]);

  return {
    mode: privacy.mode,
    teamIds: privacy.teamIds,
    userIds: privacy.userIds,
    teams: teams.map((t) => ({ id: t._id.toString(), name: t.name || 'Unnamed team' })),
    users: users.map((u) => ({ id: u._id.toString(), username: u.username, name: u.name, avatar: u.avatar || null })),
  };
}

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, db } = auth;

    const privacy = await getStatusPrivacy(db, user._id.toString());
    const resolved = await resolveForDisplay(db, privacy);
    return NextResponse.json({ success: true, privacy: resolved });
  } catch (err) {
    console.error('Status privacy GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, db } = auth;

    const body = await request.json();
    if (!PRIVACY_MODES.includes(body.mode)) {
      return NextResponse.json({ error: 'Invalid privacy mode' }, { status: 400 });
    }

    const privacy = await setStatusPrivacy(db, user._id.toString(), {
      mode: body.mode,
      teamIds: body.teamIds,
      userIds: body.userIds,
    });
    const resolved = await resolveForDisplay(db, privacy);
    return NextResponse.json({ success: true, privacy: resolved });
  } catch (err) {
    console.error('Status privacy PUT error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
