import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!ObjectId.isValid(id) || !token) {
      return NextResponse.redirect(new URL(`/events/${id}`, url.origin));
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
    if (!event) {
      return NextResponse.redirect(new URL(`/events/${id}`, url.origin));
    }

    // Mark clickedAt once
    await db.collection('events').updateOne(
      { _id: new ObjectId(id), 'tracking.token': token, 'tracking.clickedAt': { $exists: false } },
      { $set: { 'tracking.$.clickedAt': new Date() } }
    );

    const dest = event.joinUrl || event.zoomMeetingUrl || new URL(`/events/${id}`, url.origin).toString();
    return NextResponse.redirect(dest);
  } catch (e) {
    const url = new URL(request.url);
    return NextResponse.redirect(new URL(`/events/${(params||{}).id || ''}`, url.origin));
  }
}
