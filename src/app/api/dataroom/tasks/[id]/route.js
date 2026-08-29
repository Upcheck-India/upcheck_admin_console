import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth, roomOf } from '../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/tasks/[id] - Get single task
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const task = await db.collection('dataroom_tasks').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  },
  {
    requires: 'view',
    resolve: roomOf('dataroom_tasks', 'id'),
  },
);

// PUT /api/dataroom/tasks/[id] - Update task
export const PUT = withDataroomAuth(
  async (request, { user, db, params }) => {

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
  },
  {
    requires: 'edit',
    resolve: roomOf('dataroom_tasks', 'id'),
  },
);

// DELETE /api/dataroom/tasks/[id] - Delete task
export const DELETE = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

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
  },
  {
    requires: 'edit',
    resolve: roomOf('dataroom_tasks', 'id'),
  },
);
