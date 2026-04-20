import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../../lib/dataroom/audit-logger';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user;
  } catch {
    return null;
  }
}

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

// GET /api/dataroom/qa/[id] - Get single Q&A entry
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid Q&A ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const qa = await db.collection('dataroom_qa').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!qa) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Check if user can view (admins or submitter for private questions)
    if (qa.isPrivate && !isAdminLike(user) && qa.submittedBy?.id !== user._id?.toString()) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(qa);
  } catch (error) {
    console.error('GET /api/dataroom/qa/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/dataroom/qa/[id] - Answer or publish question
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid Q&A ID' }, { status: 400 });
    }

    const body = await request.json();
    const { answer, routedTo, publish = false } = body;

    const client = await clientPromise;
    const db = client.db('resources');

    const qa = await db.collection('dataroom_qa').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!qa) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const updates = { updatedAt: new Date() };

    // Update answer
    if (answer !== undefined) {
      updates.answer = answer.trim();
      updates.status = 'answered';
      updates.answeredBy = {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      };
      updates.answeredAt = new Date();
    }

    // Route to expert
    if (routedTo !== undefined) {
      updates.routedTo = routedTo;
    }

    // Publish answer
    if (publish && qa.answer) {
      updates.status = 'published';
      updates.approvedBy = {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      };
      updates.publishedAt = new Date();
    }

    await db.collection('dataroom_qa').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    await logAudit({
      action: publish ? 'QUESTION_PUBLISH' : 'QUESTION_ANSWER',
      resourceType: 'qa',
      resourceId: id,
      roomId: qa.roomId,
      user,
      details: { publish, hasAnswer: !!answer },
      request,
    });

    const updated = await db.collection('dataroom_qa').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updated);

  } catch (error) {
    console.error('PUT /api/dataroom/qa/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/dataroom/qa/[id] - Delete question
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid Q&A ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const qa = await db.collection('dataroom_qa').findOne({
      _id: new ObjectId(id),
    });

    if (!qa) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    await db.collection('dataroom_qa').updateOne(
      { _id: new ObjectId(id) },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    await logAudit({
      action: 'QUESTION_DELETE',
      resourceType: 'qa',
      resourceId: id,
      roomId: qa.roomId,
      user,
      details: { question: qa.question.substring(0, 100) },
      request,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/dataroom/qa/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
