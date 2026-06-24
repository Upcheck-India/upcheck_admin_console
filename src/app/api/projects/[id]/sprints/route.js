import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { canAccessProject, getUserPermissionLevel } from '../../../../../lib/projectPermissions';
import { sendEmail } from '../../../../../lib/emailService';

/**
 * GET  /api/projects/:id/sprints
 *      Returns list of sprints for the project (sorted by createdAt ascending)
 * POST /api/projects/:id/sprints
 *      Creates a new sprint (only Super Manager or Project Manager / full permission users)
 *      Body: { name?: string, startDate?: string, endDate?: string }
 *      If name is not provided, auto-generate 'Sprint X'.
 *      After creation, all existing project tasks without a sprintId will be migrated to the first sprint created.
 *      Tasks in the sprint will be moved to backlog (sprintId set to null)
 */

// Helper to authenticate user and return user & db instance
import { getAuthUser } from '../../../../../lib/auth';

async function authAndGetDb(request) {
  const authData = await getAuthUser(request);
  if (!authData) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { db: authData.db, user: authData.user };
}

// Helper to check if user has manager/full permission on the project
async function checkManagerPermission(db, user, project) {
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

  const perms = getUserPermissionLevel(user, project, userTeams);
  return perms?.level === 'full';
}

export async function GET(request, { params }) {
  try {
    const { db, user, error } = await authAndGetDb(request);
    if (error) return error;

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectId = new ObjectId(id);

    const project = await db.collection('projects').findOne({ _id: projectId });
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

    const sprints = await db
      .collection('project_sprints')
      .find({ projectId })
      .sort({ createdAt: 1 })
      .toArray();

    return NextResponse.json(sprints);
  } catch (err) {
    console.error('Failed to fetch sprints:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { db, user, error } = await authAndGetDb(request);
    if (error) return error;

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectId = new ObjectId(id);

    const project = await db.collection('projects').findOne({ _id: projectId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only user with full manager permission can create sprints
    const isManager = await checkManagerPermission(db, user, project);
    if (!isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, startDate, endDate } = await request.json();

    // Determine sprint count to auto-generate name if needed
    const totalSprints = await db.collection('project_sprints').countDocuments({ projectId });
    const sprintName = (name && name.trim()) || `Sprint ${totalSprints + 1}`;

    const newSprint = {
      projectId,
      name: sprintName,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertRes = await db.collection('project_sprints').insertOne(newSprint);
    newSprint._id = insertRes.insertedId;

    // Dispatch Sprint Created email if enabled
    const settings = project.settings || {};
    if (settings.sendNotifications !== false && settings.sendSprintCreationEmails !== false && project.members && project.members.length > 0) {
      const memberEmails = project.members.map(m => m.email).filter(Boolean);
      if (memberEmails.length > 0) {
        try {
          await sendEmail({
            to: memberEmails,
            subject: `New Sprint Created: ${sprintName} in Project ${project.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #2563eb; margin-top: 0;">New Sprint Created</h2>
                <p>Hello,</p>
                <p>A new sprint <strong>${sprintName}</strong> has been created in project <strong>${project.name}</strong> by <strong>${user.username}</strong>.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 120px;">Sprint Name:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${sprintName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Start Date:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${startDate ? new Date(startDate).toLocaleDateString() : 'Not set'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">End Date:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${endDate ? new Date(endDate).toLocaleDateString() : 'Not set'}</td>
                  </tr>
                </table>
                <p>Log in to the Upcheck Admin Console to view the board and assign tasks.</p>
                <br />
                <p>Best regards,</p>
                <p><strong>Upcheck Team</strong></p>
              </div>
            `,
            type: 'sprint_created'
          });
        } catch (emailError) {
          console.error(`Failed to send sprint created email:`, emailError);
        }
      }
    }

    // If this is the first sprint, migrate existing tasks with no sprintId to this sprint
    if (totalSprints === 0) {
      await db.collection('project_tasks').updateMany(
        { projectId, sprintId: { $exists: false } },
        { $set: { sprintId: newSprint._id, updatedAt: new Date() } }
      );
    }

    return NextResponse.json(newSprint, { status: 201 });
  } catch (err) {
    console.error('Failed to create sprint:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { db, user, error } = await authAndGetDb(request);
    if (error) return error;

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectId = new ObjectId(id);
    const project = await db.collection('projects').findOne({ _id: projectId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only user with full manager permission can update sprints
    const isManager = await checkManagerPermission(db, user, project);
    if (!isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { sprintId, name, startDate, endDate } = await request.json();

    if (!sprintId || !ObjectId.isValid(sprintId)) {
      return NextResponse.json({ error: 'Invalid sprint ID' }, { status: 400 });
    }

    const sprint = await db.collection('project_sprints').findOne({ _id: new ObjectId(sprintId), projectId });
    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    updateData.updatedAt = new Date();

    await db.collection('project_sprints').updateOne(
      { _id: new ObjectId(sprintId), projectId },
      { $set: updateData }
    );

    const updatedSprint = await db.collection('project_sprints').findOne({ _id: new ObjectId(sprintId), projectId });
    return NextResponse.json(updatedSprint);
  } catch (err) {
    console.error('Failed to update sprint:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { db, user, error } = await authAndGetDb(request);
    if (error) return error;

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectId = new ObjectId(id);
    const project = await db.collection('projects').findOne({ _id: projectId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only user with full manager permission can delete sprints
    const isManager = await checkManagerPermission(db, user, project);
    if (!isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { sprintId } = await request.json();

    if (!sprintId || !ObjectId.isValid(sprintId)) {
      return NextResponse.json({ error: 'Invalid sprint ID' }, { status: 400 });
    }

    const sprint = await db.collection('project_sprints').findOne({ _id: new ObjectId(sprintId), projectId });
    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    // Delete the sprint
    await db.collection('project_sprints').deleteOne({ _id: new ObjectId(sprintId), projectId });

    // Move all tasks in this sprint to backlog (set sprintId to null)
    await db.collection('project_tasks').updateMany(
      { projectId, sprintId: new ObjectId(sprintId) },
      { $set: { sprintId: null, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, message: 'Sprint deleted successfully' });
  } catch (err) {
    console.error('Failed to delete sprint:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
