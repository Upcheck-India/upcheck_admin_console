import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// PUT (update) a specific task
export async function PUT(request, { params }) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(params.id) || !ObjectId.isValid(params.taskId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(params.id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Authorization: Only Project Managers or the Super Manager can modify tasks.
    const currentUserMemberInfo = project.members.find(m => m.user === user.username);
    const isManager = currentUserMemberInfo && currentUserMemberInfo.role === 'Project Manager';
    const isSuperManager = project.superManager === user.username;

    if (!isManager && !isSuperManager) {
      return NextResponse.json({ error: 'Forbidden: Only Project Managers or the Super Manager can modify tasks.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, assignees, reporter, dueDate, status, type } = body;

    const updateData = {
      $set: {
        updatedAt: new Date(),
      },
    };

    // Selectively add fields to updateData to avoid overwriting with undefined
    if (title !== undefined) updateData.$set.title = title;
    if (description !== undefined) updateData.$set.description = description;
    if (status !== undefined) updateData.$set.status = status;
    if (type !== undefined) updateData.$set.type = type;
    if (dueDate !== undefined) updateData.$set.dueDate = dueDate ? new Date(dueDate) : null;
    if (reporter !== undefined) updateData.$set.reporter = reporter ? new ObjectId(reporter) : null;
    if (Array.isArray(assignees)) {
      updateData.$set.assignees = assignees.map(id => new ObjectId(id));
    }

    const result = await db.collection('project_tasks').updateOne(
      { _id: new ObjectId(params.taskId) }, 
      updateData
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updatedTask = await db.collection('project_tasks').findOne({ 
      _id: new ObjectId(params.taskId) 
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}

// DELETE a specific task
export async function DELETE(request, { params }) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(params.id) || !ObjectId.isValid(params.taskId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(params.id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Authorization: Only Project Managers or the Super Manager can delete tasks.
    const currentUserMemberInfo = project.members.find(m => m.user === user.username);
    const isManager = currentUserMemberInfo && currentUserMemberInfo.role === 'Project Manager';
    const isSuperManager = project.superManager === user.username;

    if (!isManager && !isSuperManager) {
      return NextResponse.json({ error: 'Forbidden: Only Project Managers or the Super Manager can delete tasks.' }, { status: 403 });
    }

    const result = await db.collection('project_tasks').deleteOne({ 
      _id: new ObjectId(params.taskId) 
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}