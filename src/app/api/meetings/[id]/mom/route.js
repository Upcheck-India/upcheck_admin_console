import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserFromToken } from '../../../../../lib/eventAuthHelper';

/**
 * Resolves the authenticated user from Bearer token (mobile) or cookie (web).
 */
async function getUser(request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : request.cookies.get('admin_token')?.value;
  return token ? await getUserFromToken(token) : null;
}

/**
 * POST /api/meetings/[id]/mom
 * Appends a MoM (Minutes of Meeting) document to the meeting.
 * The file has already been uploaded; the client sends the URL.
 *
 * Body: { name: string, url: string, uploadedBy: string }
 * RBAC: user must be host or participant.
 *
 * Returns: { success: true, momDocuments: [...] }
 */
export async function POST(request, { params }) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const { id } = await params;

    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid meeting ID.' }, { status: 400 });
    }

    const body = await request.json();
    const { name, url, uploadedBy } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Document name is required.' }, { status: 400 });
    }
    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'Document URL is required.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const meeting = await db.collection('events').findOne(
      { _id: objectId },
      { projection: { host: 1, participants: 1 } }
    );

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }

    const userEmail = user.email.toLowerCase();
    const isHost = (meeting.host || '').toLowerCase() === userEmail;
    const isParticipant = (meeting.participants || []).some(
      (p) => p && p.toLowerCase() === userEmail
    );

    if (!isHost && !isParticipant) {
      return NextResponse.json(
        { error: 'Forbidden. You are not a participant of this meeting.' },
        { status: 403 }
      );
    }

    const momEntry = {
      name: name.trim(),
      url: url.trim(),
      uploadedBy: uploadedBy || user.email,
      uploadedAt: new Date(),
    };

    const result = await db.collection('events').findOneAndUpdate(
      { _id: objectId },
      {
        $push: { momDocuments: momEntry },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    return NextResponse.json({
      success: true,
      momDocuments: result?.momDocuments || [],
    });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/mom] Error:', error);
    return NextResponse.json({ error: 'Failed to add MoM document.' }, { status: 500 });
  }
}
