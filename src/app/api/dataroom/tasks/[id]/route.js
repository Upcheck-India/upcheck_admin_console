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

// GET /api/dataroom/tasks/[id] - Get single task
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const task = await db.collection('dataroom_tasks').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('GET /api/dataroom/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/dataroom/tasks/[id] - Update task
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      title,
      description,
      assignedToEmail,
      assignedToName,
      status,
      priority,
      category,
      dueDate,
      addComment,
    } = body;

    const client = await clientPromise;
    const db = client.db('resources');

    const task = await db.collection('dataroom_tasks').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updates = { updatedAt: new Date() };

    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (assignedToEmail !== undefined) updates.assignedToEmail = assignedToEmail;
    if (assignedToName !== undefined) updates.assignedToName = assignedToName;
    if (priority !== undefined) updates.priority = priority;
    if (category !== undefined) updates.category = category;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;

    // Handle status changes
    if (status !== undefined && status !== task.status) {
      updates.status = status;
      if (status === 'completed') {
        updates.completedAt = new Date();
        updates.completedBy = {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
        };
      } else if (status !== 'completed' && task.status === 'completed') {
        // Reopening task
        updates.completedAt = null;
        updates.completedBy = null;
      }
    }

    // Handle comments
    const updateOperations = { $set: updates };
    
    if (addComment && addComment.trim().length > 0) {
      updateOperations.$push = {
        comments: {
          text: addComment.trim(),
          addedBy: {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
          },
          addedAt: new Date(),
        },
      };
    }

    await db.collection('dataroom_tasks').updateOne(
      { _id: new ObjectId(id) },
      updateOperations
    );

    await logAudit({
      action: 'TASK_UPDATE',
      resourceType: 'task',
      resourceId: id,
      roomId: task.roomId,
      user,
      details: {
        title: task.title,
        updates: Object.keys(updates),
        newStatus: status,
      },
      request,
    });

    const updated = await db.collection('dataroom_tasks').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updated);

  } catch (error) {
    console.error('PUT /api/dataroom/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/dataroom/tasks/[id] - Delete task
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const task = await db.collection('dataroom_tasks').findOne({ _id: new ObjectId(id) });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Soft delete
    await db.collection('dataroom_tasks').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: user._id.toString(),
        },
      }
    );

    await logAudit({
      action: 'TASK_DELETE',
      resourceType: 'task',
      resourceId: id,
      roomId: task.roomId,
      user,
      details: { title: task.title },
      request,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/dataroom/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
