import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { canAccessProject } from '../../../../lib/projectPermissions';

// Sanitize tag: lowercase, alphanumeric + hyphens only, max 20 chars
function sanitizeTag(tag) {
  if (typeof tag !== 'string') return null;
  const sanitized = tag.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return sanitized.slice(0, 20) || null;
}

// Sanitize tags array
function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const sanitized = tags.map(sanitizeTag).filter(Boolean);
  return [...new Set(sanitized)];
}

// PUT - Update a project by ID
export async function PUT(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectsCollection = db.collection('projects');
    const project = await projectsCollection.findOne({ _id: new ObjectId(id) });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Security check: Only the superManager or a Project Manager can update the project.
    const isSuperManager = project.superManager === user.username;
    const isProjectManager = project.members?.some(member => member.user === user.username && member.role === 'Project Manager');

    if (!isSuperManager && !isProjectManager) {
      return NextResponse.json({ error: 'Access denied: Only the Super Manager or a Project Manager can edit this project.' }, { status: 403 });
    }

    const { name, description, logo, members, githubRepoUrl, status, tags } = await req.json();

    // Build update object dynamically to only update provided fields
    const updateFields = { updatedAt: new Date() };

    if (name !== undefined) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description?.trim() || '';
    if (logo !== undefined) updateFields.logo = logo || '';
    if (members !== undefined) updateFields.members = members;
    if (githubRepoUrl !== undefined) updateFields.githubRepoUrl = githubRepoUrl || '';

    // Validate and set status if provided
    if (status !== undefined) {
      const validStatuses = ['active', 'ideation', 'paused', 'shelved', 'archived', 'dismissed'];
      if (validStatuses.includes(status)) {
        updateFields.status = status;
      }
    }

    // Sanitize and set tags if provided
    if (tags !== undefined) {
      updateFields.tags = sanitizeTags(tags);
    }

    const updateData = { $set: updateFields };

    await projectsCollection.updateOne({ _id: new ObjectId(id) }, updateData);

    // Log activity for member changes
    if (members !== undefined) {
      const oldMembers = project.members || [];
      const newMembers = members || [];

      const addedMembers = newMembers.filter(m =>
        !oldMembers.some(om => om.user === m.user)
      );
      const removedMembers = oldMembers.filter(m =>
        !newMembers.some(nm => nm.user === m.user)
      );
      const roleChanges = newMembers.filter(m => {
        const old = oldMembers.find(om => om.user === m.user);
        return old && old.role !== m.role;
      });

      try {
        const logEntries = [];

        for (const member of addedMembers) {
          logEntries.push({
            projectId: id,
            action: 'member_add',
            resourceType: 'project',
            resourceName: project.name,
            userId: user._id,
            username: user.username,
            timestamp: new Date(),
            metadata: {
              targetUser: member.user,
              targetEmail: member.email,
              role: member.role,
            }
          });
        }

        for (const member of removedMembers) {
          logEntries.push({
            projectId: id,
            action: 'member_remove',
            resourceType: 'project',
            resourceName: project.name,
            userId: user._id,
            username: user.username,
            timestamp: new Date(),
            metadata: {
              targetUser: member.user,
              targetEmail: member.email,
              previousRole: member.role,
            }
          });
        }

        for (const member of roleChanges) {
          const oldMember = oldMembers.find(om => om.user === member.user);
          logEntries.push({
            projectId: id,
            action: 'member_role_change',
            resourceType: 'project',
            resourceName: project.name,
            userId: user._id,
            username: user.username,
            timestamp: new Date(),
            metadata: {
              targetUser: member.user,
              targetEmail: member.email,
              oldRole: oldMember?.role,
              newRole: member.role,
            }
          });
        }

        if (logEntries.length > 0) {
          await db.collection('doc_activity_logs').insertMany(logEntries);
        }
      } catch (logError) {
        console.error('Failed to log member activity:', logError);
      }
    }

    const updatedProject = await projectsCollection.findOne({ _id: new ObjectId(id) });

    return NextResponse.json(updatedProject, { status: 200 });
  } catch (error) {
    console.error(`Error updating project ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}


// DELETE - Deletes a project by ID
export async function DELETE(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectsCollection = db.collection('projects');
    const project = await projectsCollection.findOne({ _id: new ObjectId(id) });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Security check: Only the superManager or a Project Manager can delete the project.
    const isSuperManager = project.superManager === user.username;
    const isProjectManager = project.members?.some(member => member.user === user.username && member.role === 'Project Manager');

    if (!isSuperManager && !isProjectManager) {
      return NextResponse.json({ error: 'Access denied: Only the Super Manager or a Project Manager can delete this project.' }, { status: 403 });
    }

    await projectsCollection.deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ message: 'Project deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting project ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

// GET - Fetch a single project by ID
export async function GET(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch user's teams for team-based permission checking
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
        ],
      })
      .toArray();

    // Check if user can access the project using permission system
    if (!canAccessProject(user, project, userTeams)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error(`Error fetching project ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}
