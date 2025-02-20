// src/app/api/tasks/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from 'mongodb';

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Add sort to show newest tasks first
    const tasks = await db.collection('tasks')
      .find({})
      .sort({ time_published: -1 })
      .toArray();
    
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const body = await req.json();
    
    const newTask = {
      task_name: body.task_name,
      assigned_for: body.assigned_for || [],
      time_published: new Date(),
      due_time: new Date(body.due_time),
      created_by: body.created_by,
      modified_by: body.modified_by,
      status: body.assigned_for?.length > 0 ? 'Assigned' : 'Planned', // Default status based on assignees
      priority: body.priority || 'Normal',
      subtasks: body.subtasks || [],
      description: body.description || '',
      modified_history: [{
        modified_by: body.created_by,
        modified_at: new Date(),
        action: 'Created task'
      }]
    };

    const result = await db.collection('tasks').insertOne(newTask);

    // Update notifications for assigned users
    if (body.assigned_for?.length > 0) {
      await db.collection('admin_users').updateMany(
        { username: { $in: body.assigned_for } },
        { 
          $inc: { notifs: 1 },
          $push: { 
            notifTitles: `New task assigned: ${body.task_name}`
          }
        }
      );
    }

    return NextResponse.json({
      success: true,
      _id: result.insertedId.toString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}