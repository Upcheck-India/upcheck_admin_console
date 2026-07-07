import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../lib/auth';
import { isValidDisplayMode, isAdminRole } from '../../../lib/changelogs';

// GET /api/changelogs
//   - default: published entries only, newest first (the in-app "What's New"
//     full-page history, and the console's "Active" list).
//   - ?all=true (admin only): every entry including drafts, for the console
//     management panel.
export async function GET(request) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = authData;

    const { searchParams } = new URL(request.url);
    const wantAll = searchParams.get('all') === 'true';

    let query = { isPublished: true };
    if (wantAll) {
      if (!isAdminRole(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      query = {};
    }

    const changelogs = await db.collection('changelogs')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({ changelogs });
  } catch (error) {
    console.error('Error fetching changelogs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/changelogs — create a new entry (admin only). Starts as a draft
// (isPublished:false) unless publish:true is passed.
export async function POST(request) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = authData;

    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { title, body: content, version, displayMode, publish } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Body is required' }, { status: 400 });
    }
    if (!isValidDisplayMode(displayMode)) {
      return NextResponse.json({ error: 'Invalid displayMode' }, { status: 400 });
    }

    const now = new Date();
    const changelog = {
      title: title.trim(),
      body: content.trim(),
      version: version ? String(version).trim() : '',
      displayMode,
      isPublished: !!publish,
      createdBy: {
        id: user._id.toString(),
        username: user.username,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.username,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('changelogs').insertOne(changelog);

    return NextResponse.json({
      changelog: { _id: result.insertedId, ...changelog },
    });
  } catch (error) {
    console.error('Error creating changelog:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
