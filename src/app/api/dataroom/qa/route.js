import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/qa - List Q&A entries
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const status = searchParams.get('status');
    const documentId = searchParams.get('documentId');

    const filter = { isDeleted: { $ne: true } };

    if (roomId && ObjectId.isValid(roomId)) {
      filter.roomId = new ObjectId(roomId);
    }

    if (status && ['pending', 'answered', 'published'].includes(status)) {
      filter.status = status;
    }

    if (documentId && ObjectId.isValid(documentId)) {
      filter.documentId = new ObjectId(documentId);
    }

    const questions = await db.collection('dataroom_qa')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ count: questions.length, items: questions });
  },
  {
    requires: 'view',
    resource: { type: 'room', query: 'roomId' },
    allowExternal: true,
  },
);

// POST /api/dataroom/qa - Submit a question
export const POST = withDataroomAuth(
  async (request, { user, db, params }) => {

    const body = await request.json();
    const {
      roomId,
      documentId = null,
      folderId = null,
      question,
      isPrivate = false,
    } = body;

    if (!roomId || !ObjectId.isValid(roomId)) {
      return NextResponse.json({ error: 'Valid roomId is required' }, { status: 400 });
    }

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Verify room exists
    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(roomId),
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const newQuestion = {
      roomId: new ObjectId(roomId),
      documentId: documentId && ObjectId.isValid(documentId) ? new ObjectId(documentId) : null,
      folderId: folderId && ObjectId.isValid(folderId) ? new ObjectId(folderId) : null,
      question: question.trim(),
      isPrivate, // Only visible to submitter and admins
      status: 'pending', // pending, answered, published
      submittedBy: {
        id: user._id?.toString() || null,
        email: user.email,
        username: user.username,
        isExternal: false, // Would be true for external users
      },
      answer: null,
      answeredBy: null,
      answeredAt: null,
      approvedBy: null,
      publishedAt: null,
      routedTo: null, // Internal expert email/user
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('dataroom_qa').insertOne(newQuestion);

    await logAudit({
      action: 'QUESTION_SUBMIT',
      resourceType: 'qa',
      resourceId: result.insertedId,
      roomId: new ObjectId(roomId),
      user,
      details: { question: question.substring(0, 100), isPrivate },
      request,
    });

    return NextResponse.json({ ...newQuestion, _id: result.insertedId }, { status: 201 });
  },
  {
    requires: 'comment',
    resource: { type: 'room', query: 'roomId' },
    allowExternal: true,
  },
);
