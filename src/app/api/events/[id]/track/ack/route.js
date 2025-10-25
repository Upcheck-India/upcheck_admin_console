import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request, { params }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const { id } = await params;

  try {
    if (!ObjectId.isValid(id) || !token) {
      return NextResponse.redirect(new URL(`/events/${id}`, url.origin));
    }

    const client = await clientPromise;
    const db = client.db('resources');

    await db.collection('events').updateOne(
      { _id: new ObjectId(id), 'tracking.token': token, 'tracking.ackAt': { $exists: false } },
      { $set: { 'tracking.$.ackAt': new Date() } }
    );

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thank you</title></head><body style="font-family: Arial, sans-serif; padding: 24px; text-align:center;">
      <h2 style="color:#16a34a;">Thanks! Your receipt has been acknowledged.</h2>
      <p style="color:#374151;">You can now close this tab.</p>
    </body></html>`;

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e) {
    return NextResponse.redirect(new URL(`/events/${id}`, url.origin));
  }
}
