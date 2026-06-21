import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserPermissionLevel } from '../../../../../../lib/projectPermissions';
import { sendEmail } from '../../../../../../lib/emailService';

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

    const { id, taskId } = await params;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch user's teams using robust query supporting both String and ObjectId user matches
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
          { members: user._id },
          { lead: user._id },
        ],
      })
      .toArray();

    // Authorization using permission level and overrides
    const perms = getUserPermissionLevel(user, project, userTeams);
    const hasFullPermission = perms && perms.level === 'full';
    const isContributor = perms && perms.level === 'write';

    const settings = project.settings || {};
    const allowContributorsUpdateTasks = settings.allowContributorsUpdateTasks !== false; // default true

    const canUpdate = hasFullPermission || (isContributor && allowContributorsUpdateTasks);

    if (!canUpdate) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to modify tasks in this project.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, assignees, reporter, dueDate, status, type, sprintId, subtasks } = body;

    // Send email notification if assignees changed
    if (Array.isArray(assignees)) {
      const oldTask = await db.collection('project_tasks').findOne({ _id: new ObjectId(taskId) });
      const oldAssignees = (oldTask?.assignees || []).map(a => a.toString());
      const newAssignees = assignees.map(a => a.toString());
      const newlyAddedAssignees = newAssignees.filter(a => !oldAssignees.includes(a));

      if (newlyAddedAssignees.length > 0 && settings.sendNotifications !== false && settings.sendTaskAssignmentEmails !== false) {
        // Resolve emails of newly added assignees
        const resolvedUsers = await db.collection('admin_users')
          .find({ _id: { $in: newlyAddedAssignees.map(aId => new ObjectId(aId)) } })
          .toArray();

        for (const targetUser of resolvedUsers) {
          if (targetUser.email) {
            try {
              await sendEmail({
                to: targetUser.email,
                subject: `New Task Assigned: ${title || oldTask?.title || 'Untitled Task'}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2563eb; margin-top: 0;">Task Assigned to You</h2>
                    <p>Hello ${targetUser.name || targetUser.username || 'there'},</p>
                    <p>You have been assigned a new task in project <strong>${project.name}</strong>.</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 120px;">Task Title:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title || oldTask?.title || 'Untitled Task'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Status:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${status || oldTask?.status || 'Backlog'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Description:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${description || oldTask?.description || 'No description provided'}</td>
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
    }

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
    if (sprintId !== undefined) {
      if (sprintId && ObjectId.isValid(sprintId)) {
        updateData.$set.sprintId = new ObjectId(sprintId);
      } else if (!sprintId) {
        updateData.$unset = { ...(updateData.$unset || {}), sprintId: "" };
      }
    }
    if (dueDate !== undefined) updateData.$set.dueDate = dueDate ? new Date(dueDate) : null;
    if (reporter !== undefined) updateData.$set.reporter = reporter ? new ObjectId(reporter) : null;
    if (Array.isArray(assignees)) {
      updateData.$set.assignees = assignees.map(aId => new ObjectId(aId));
    }
    if (Array.isArray(subtasks)) {
      // Validate subtasks or just pass them through
      updateData.$set.subtasks = subtasks;
    }

    const result = await db.collection('project_tasks').updateOne(
      { _id: new ObjectId(taskId) }, 
      updateData
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updatedTask = await db.collection('project_tasks').findOne({ 
      _id: new ObjectId(taskId) 
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

    const { id, taskId } = await params;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch user's teams using robust query supporting both String and ObjectId user matches
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
          { members: user._id },
          { lead: user._id },
        ],
      })
      .toArray();

    // Authorization
    const perms = getUserPermissionLevel(user, project, userTeams);
    const hasFullPermission = perms && perms.level === 'full';
    const isContributor = perms && perms.level === 'write';

    const settings = project.settings || {};
    const allowContributorsDeleteTasks = settings.allowContributorsDeleteTasks === true; // default false

    const canDelete = hasFullPermission || (isContributor && allowContributorsDeleteTasks);

    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to delete tasks in this project.' }, { status: 403 });
    }

    const result = await db.collection('project_tasks').deleteOne({ 
      _id: new ObjectId(taskId) 
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