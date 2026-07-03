import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import {
  normalizeRealtimePrefs,
  buildRealtimeUpdate,
} from '../../../../lib/realtimePreferences';

// GET /api/settings/realtime-preferences
// Returns the caller's four transport modes, defaulting all to 'realtime'
// when no document exists yet.
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;
    const userId = user._id.toString();

    const doc = await db.collection('user_preferences').findOne({ userId });
    return NextResponse.json({ realtime: normalizeRealtimePrefs(doc?.realtime) });
  } catch (err) {
    console.error('Get realtime preferences error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/settings/realtime-preferences
// Partial upsert. Body: { messaging?, typing?, presence?, notifications? },
// each 'realtime' | 'polling'.
export async function PUT(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;
    const userId = user._id.toString();

    const body = await request.json().catch(() => ({}));
    const { set, error } = buildRealtimeUpdate(body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    if (Object.keys(set).length === 0) {
      return NextResponse.json(
        { error: 'No valid preference fields provided' },
        { status: 400 }
      );
    }

    await db.collection('user_preferences').updateOne(
      { userId },
      {
        $set: { ...set, updatedAt: new Date() },
        $setOnInsert: { userId },
      },
      { upsert: true }
    );

    const doc = await db.collection('user_preferences').findOne({ userId });
    return NextResponse.json({
      success: true,
      realtime: normalizeRealtimePrefs(doc?.realtime),
    });
  } catch (err) {
    console.error('Update realtime preferences error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
