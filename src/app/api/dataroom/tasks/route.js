import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../lib/dataroom/audit-logger';

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

// GET /api/dataroom/tasks - List tasks
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const documentId = searchParams.get('documentId');
    const assignedTo = searchParams.get('assignedTo');
    const status = searchParams.get('status'); // pending | in_progress | completed | cancelled
    const priority = searchParams.get('priority'); // low | medium | high | urgent

    const client = await clientPromise;
    const db = client.db('resources');

    const filter = { isDeleted: { $ne: true } };

    if (roomId) {
      if (!ObjectId.isValid(roomId)) {
        return NextResponse.json({ error: 'Invalid roomId' }, { status: 400 });
      }
      filter.roomId = new ObjectId(roomId);
    }

    if (documentId) {
      if (!ObjectId.isValid(documentId)) {
        return NextResponse.json({ error: 'Invalid documentId' }, { status: 400 });
      }
      filter.documentId = new ObjectId(documentId);
    }

    if (assignedTo) {
      filter.assignedToEmail = assignedTo;
    }

    if (status) {
      filter.status = status;
    }

    if (priority) {
      filter.priority = priority;
    }

    const tasks = await db.collection('dataroom_tasks')
      .find(filter)
      .sort({ dueDate: 1, priority: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({
      count: tasks.length,
      tasks,
    });

  } catch (error) {
    console.error('GET /api/dataroom/tasks error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/dataroom/tasks - Create task
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      roomId,
      documentId = null,
      folderId = null,
      title,
      description = '',
      assignedToEmail,
      assignedToName = '',
      dueDate = null,
      priority = 'medium', // low | medium | high | urgent
      category = 'review', // review | approval | question | follow_up | other
    } = body;

    if (!roomId || !ObjectId.isValid(roomId)) {
      return NextResponse.json({ error: 'Valid roomId is required' }, { status: 400 });
    }

    if (!title || title.trim().length === 0) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    if (!assignedToEmail || !assignedToEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid assignedToEmail is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify room exists
    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(roomId),
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verify document if provided
    if (documentId) {
      if (!ObjectId.isValid(documentId)) {
        return NextResponse.json({ error: 'Invalid documentId' }, { status: 400 });
      }
      const document = await db.collection('dataroom_documents').findOne({
        _id: new ObjectId(documentId),
        roomId: new ObjectId(roomId),
      });
      if (!document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
    }

    const newTask = {
      roomId: new ObjectId(roomId),
      documentId: documentId ? new ObjectId(documentId) : null,
      folderId: folderId ? new ObjectId(folderId) : null,
      title: title.trim(),
      description: description.trim(),
      assignedToEmail,
      assignedToName,
      assignedBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      status: 'pending',
      priority,
      category,
      dueDate: dueDate ? new Date(dueDate) : null,
      completedAt: null,
      completedBy: null,
      comments: [],
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('dataroom_tasks').insertOne(newTask);

    await logAudit({
      action: 'TASK_CREATE',
      resourceType: 'task',
      resourceId: result.insertedId,
      roomId: new ObjectId(roomId),
      user,
      details: {
        title: newTask.title,
        assignedTo: assignedToEmail,
        priority,
        category,
      },
      request,
    });

    return NextResponse.json({ ...newTask, _id: result.insertedId }, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/tasks error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
