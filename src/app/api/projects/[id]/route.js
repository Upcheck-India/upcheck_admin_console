import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { canAccessProject, canManagePermissions } from '../../../../lib/projectPermissions';
import { sendEmail } from '../../../../lib/emailService';

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

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectsCollection = db.collection('projects');
    const project = await projectsCollection.findOne({ _id: new ObjectId(id) });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch user's teams for permission checking
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

    // Security check: must have project management permissions
    if (!canManagePermissions(user, project, userTeams)) {
      return NextResponse.json({ error: 'Access denied: You do not have permission to edit this project.' }, { status: 403 });
    }

    const { 
      name, description, logo, members, githubRepoUrl, status, tags,
      allowContributorsUpdateTasks,
      allowContributorsDeleteTasks,
      sendNotifications,
      sendTaskAssignmentEmails,
      sendSprintCreationEmails,
      sendProjectInviteEmails,
      enableIdeaCanvas,
      githubIntegrationEnabled,
      trackTaskActivity,
      githubPAT,
      showFileBrowser,
      showCommits,
      showBranches,
      showContributors
    } = await req.json();

    // Build update object dynamically to only update provided fields
    const updateFields = { updatedAt: new Date() };

    if (name !== undefined) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description?.trim() || '';
    if (logo !== undefined) updateFields.logo = logo || '';
    if (members !== undefined) updateFields.members = members;
    if (githubRepoUrl !== undefined) updateFields.githubRepoUrl = githubRepoUrl || '';

    // Construct settings object if any settings are provided
    if (allowContributorsUpdateTasks !== undefined || 
        allowContributorsDeleteTasks !== undefined || 
        sendNotifications !== undefined || 
        sendTaskAssignmentEmails !== undefined || 
        sendSprintCreationEmails !== undefined || 
        sendProjectInviteEmails !== undefined || 
        enableIdeaCanvas !== undefined || 
        githubIntegrationEnabled !== undefined || 
        trackTaskActivity !== undefined ||
        githubPAT !== undefined ||
        showFileBrowser !== undefined ||
        showCommits !== undefined ||
        showBranches !== undefined ||
        showContributors !== undefined) {
      
      updateFields.settings = {
        ...(project.settings || {}),
        ...(allowContributorsUpdateTasks !== undefined && { allowContributorsUpdateTasks }),
        ...(allowContributorsDeleteTasks !== undefined && { allowContributorsDeleteTasks }),
        ...(sendNotifications !== undefined && { sendNotifications }),
        ...(sendTaskAssignmentEmails !== undefined && { sendTaskAssignmentEmails }),
        ...(sendSprintCreationEmails !== undefined && { sendSprintCreationEmails }),
        ...(sendProjectInviteEmails !== undefined && { sendProjectInviteEmails }),
        ...(enableIdeaCanvas !== undefined && { enableIdeaCanvas }),
        ...(githubIntegrationEnabled !== undefined && { githubIntegrationEnabled }),
        ...(trackTaskActivity !== undefined && { trackTaskActivity }),
        ...(githubPAT !== undefined || showFileBrowser !== undefined || showCommits !== undefined || showBranches !== undefined || showContributors !== undefined ? {
          github: {
            ...(project.settings?.github || {}),
            ...(githubPAT !== undefined && { personalAccessToken: githubPAT }),
            ...(showFileBrowser !== undefined && { showFileBrowser }),
            ...(showCommits !== undefined && { showCommits }),
            ...(showBranches !== undefined && { showBranches }),
            ...(showContributors !== undefined && { showContributors }),
          }
        } : {})
      };
    }

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

    // Log activity for member changes and send emails
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

      // Send email notifications to added members if enabled
      const currentSettings = updateFields.settings || project.settings || {};
      if (addedMembers.length > 0 && currentSettings.sendNotifications !== false && currentSettings.sendProjectInviteEmails !== false) {
        for (const member of addedMembers) {
          if (member.email) {
            try {
              await sendEmail({
                to: member.email,
                subject: `You have been added to the project: ${project.name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2563eb; margin-top: 0;">Project Invitation</h2>
                    <p>Hello,</p>
                    <p>You have been added to the project <strong>${project.name}</strong> as a <strong>${member.role || 'Contributor'}</strong>.</p>
                    <p>Log in to the Upcheck Admin Console to view the project dashboard and start collaborating.</p>
                    <br />
                    <p>Best regards,</p>
                    <p><strong>Upcheck Team</strong></p>
                  </div>
                `,
                type: 'project_invite'
              });
            } catch (emailError) {
              console.error(`Failed to send project invite email to ${member.email}:`, emailError);
            }
          }
        }
      }

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

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectsCollection = db.collection('projects');
    const project = await projectsCollection.findOne({ _id: new ObjectId(id) });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch user's teams for permission checking
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

    // Security check: must have project management permissions
    if (!canManagePermissions(user, project, userTeams)) {
      return NextResponse.json({ error: 'Access denied: You do not have permission to delete this project.' }, { status: 403 });
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

    const { id } = await params;
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
          { members: user._id },
          { lead: user._id },
        ],
      })
      .toArray();

    // Check if user can access the project using permission system
    if (!canAccessProject(user, project, userTeams)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Populate team names and member details for allowed teams if they exist
    if (project.permissionSettings?.allowedTeams?.length > 0) {
      const allowedTeamIds = [];
      project.permissionSettings.allowedTeams.forEach(tid => {
        allowedTeamIds.push(tid);
        try {
          allowedTeamIds.push(new ObjectId(tid));
        } catch (e) {
          // ignore
        }
      });

      const teamsData = await db.collection('teams')
        .find({ _id: { $in: allowedTeamIds } })
        .toArray();

      // Collect all unique user IDs from these teams
      const allUserIds = new Set();
      teamsData.forEach(team => {
        if (team.lead) allUserIds.add(team.lead.toString());
        if (team.members) {
          team.members.forEach(m => {
            if (m) allUserIds.add(m.toString());
          });
        }
      });

      // Fetch user details for those users
      const userIdArray = Array.from(allUserIds).map(id => {
        try {
          return new ObjectId(id);
        } catch {
          return id;
        }
      });

      const usersData = await db.collection('admin_users')
        .find({ _id: { $in: userIdArray } })
        .project({ username: 1, email: 1, role: 1, firstName: 1, lastName: 1, department: 1, jobTitle: 1 })
        .toArray();

      const userLookup = new Map();
      usersData.forEach(user => {
        userLookup.set(user._id.toString(), user);
      });

      project.permissionSettings.allowedTeamsDetails = teamsData.map(team => {
        const lead = team.lead ? userLookup.get(team.lead.toString()) : null;
        const members = (team.members || [])
          .map(mId => userLookup.get(mId?.toString() || mId))
          .filter(Boolean);

        return {
          id: team._id.toString(),
          name: team.name,
          lead,
          members,
          memberCount: members.length
        };
      });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error(`Error fetching project ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}
