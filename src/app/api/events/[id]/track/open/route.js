import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  'base64'
);

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams, origin } = new URL(request.url);
    const token = searchParams.get('token');
    if (!ObjectId.isValid(id) || !token) {
      return new NextResponse(PIXEL, {
        status: 200,
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
      });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    await db.collection('events').updateOne(
      { _id: new ObjectId(id), 'tracking.token': token, 'tracking.openedAt': { $exists: false } },
      { $set: { 'tracking.$.openedAt': new Date() } }
    );

    return new NextResponse(PIXEL, {
      status: 200,
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new NextResponse(PIXEL, {
      status: 200,
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    });
  }
}
