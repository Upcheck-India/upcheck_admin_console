import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { canAccessProject, canCreateInProject } from '../../../../../lib/projectPermissions';
import { sendEmail } from '../../../../../lib/emailService';

// GET all tasks for a project
export async function GET(request, { params }) {
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

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify membership / access using the permission system
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
        { lead: userIdStr },
        { members: user._id },
        { lead: user._id },
          { members: user._id },
          { lead: user._id },
        ],
      })
      .toArray();

    if (!canAccessProject(user, project, userTeams)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Support optional sprintId filtering via ?sprintId=<id>
    const { searchParams } = new URL(request.url);
    const sprintIdParam = searchParams.get('sprintId');

    let taskQuery = { projectId: new ObjectId(id) };
    if (sprintIdParam) {
      if (ObjectId.isValid(sprintIdParam)) {
        taskQuery.sprintId = new ObjectId(sprintIdParam);
      } else if (sprintIdParam === 'null' || sprintIdParam === 'none') {
        taskQuery.sprintId = { $exists: false };
      }
    }

    const tasks = await db.collection('project_tasks').find(taskQuery).toArray();

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST a new task to a project
export async function POST(request, { params }) {
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

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify write permissions using the permission system
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
        { lead: userIdStr },
        { members: user._id },
        { lead: user._id },
          { members: user._id },
          { lead: user._id },
        ],
      })
      .toArray();

    if (!canCreateInProject(user, project, userTeams)) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to create tasks in this project.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, status, assignees, reporter, dueDate, type, sprintId, subtasks, priority, labels, storyPoints, startDate, endDate } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const newTaskDocument = {
      projectId: new ObjectId(id),
      ...(sprintId && ObjectId.isValid(sprintId) ? { sprintId: new ObjectId(sprintId) } : {}),
      title,
      description: description || '',
      assignees: Array.isArray(assignees) ? assignees.map(tId => new ObjectId(tId)) : [],
      reporter: reporter ? new ObjectId(reporter) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: status || 'Backlog',
      type: type || 'Feature',
      subtasks: Array.isArray(subtasks) ? subtasks : [],
      priority: priority || 'Medium',
      labels: Array.isArray(labels) ? labels : [],
      storyPoints: typeof storyPoints === 'number' ? storyPoints : 0,
      activity: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('project_tasks').insertOne(newTaskDocument);

    // Send email notifications to assigned users if enabled
    const settings = project.settings || {};
    if (Array.isArray(assignees) && assignees.length > 0 && settings.sendNotifications !== false && settings.sendTaskAssignmentEmails !== false) {
      const resolvedUsers = await db.collection('admin_users')
        .find({ _id: { $in: assignees.map(tId => new ObjectId(tId)) } })
        .toArray();

      for (const targetUser of resolvedUsers) {
        if (targetUser.email) {
          try {
            await sendEmail({
              to: targetUser.email,
              subject: `New Task Assigned: ${title}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                  <h2 style="color: #2563eb; margin-top: 0;">Task Assigned to You</h2>
                  <p>Hello ${targetUser.name || targetUser.username || 'there'},</p>
                  <p>You have been assigned a new task in project <strong>${project.name}</strong>.</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 120px;">Task Title:</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Status:</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${status || 'Backlog'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Description:</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${description || 'No description provided'}</td>
                    </tr>
                  </table>
                  <p>Log in to the Upcheck Admin Console to view and update the task status.</p>
                  <br />
                  <p>Best regards,</p>
                  <p><strong>Upcheck Team</strong></p>
                </div>
              `,
              type: 'task_assigned'
            });
          } catch (emailError) {
            console.error(`Failed to send task assignment email to ${targetUser.email}:`, emailError);
          }
        }
      }
    }

    return NextResponse.json({ ...newTaskDocument, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
