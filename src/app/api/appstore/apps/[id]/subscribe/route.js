import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid app ID' }, { status: 400 });
    }

    const app = await db.collection('appstore_apps').findOne({ _id: new ObjectId(id) });
    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    const userIdStr = user._id.toString();
    const subscribers = app.subscribers || [];
    const isSubscribed = subscribers.includes(userIdStr);

    let updateQuery;
    if (isSubscribed) {
      // Unsubscribe
      updateQuery = { $pull: { subscribers: userIdStr } };
    } else {
      // Subscribe
      updateQuery = { $addToSet: { subscribers: userIdStr } };
    }

    await db.collection('appstore_apps').updateOne(
      { _id: new ObjectId(id) },
      updateQuery
    );

    return NextResponse.json({
      success: true,
      isSubscribed: !isSubscribed,
      message: !isSubscribed ? 'Subscribed to update notifications' : 'Unsubscribed from update notifications'
    });
  } catch (error) {
    console.error('App Store apps subscribe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
