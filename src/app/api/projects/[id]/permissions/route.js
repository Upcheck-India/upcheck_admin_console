import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { canManagePermissions, canAccessProject, getDefaultPermissionSettings } from '../../../../../lib/projectPermissions';

// Default permissions for General space
// Interns: no access by default
// Members: read, write, download own files only
// Admin/Console admin: full access (locked)
const GENERAL_DEFAULT_PERMISSIONS = {
  accessMode: 'roles_based',
  allowedRoles: ['Console admin', 'Admin', 'Member'],
  rolePermissions: {
    'Console admin': { readScope: 'all', writeScope: 'all', downloadScope: 'all' },
    'Admin': { readScope: 'all', writeScope: 'all', downloadScope: 'all' },
    'Member': { readScope: 'all', writeScope: 'own', downloadScope: 'own' },
    'Intern': { readScope: 'none', writeScope: 'none', downloadScope: 'none' },
  },
  allowedTeams: [],
  teamPermissions: {},
  managedBy: ['superManager', 'projectManager'],
};

// Helper to get general space permissions
async function getGeneralSpacePermissions(db) {
  const generalPerms = await db.collection('general_space_permissions').findOne({ _id: 'general' });
  return generalPerms?.permissionSettings || GENERAL_DEFAULT_PERMISSIONS;
}

// Helper to update general space permissions
async function updateGeneralSpacePermissions(db, permissionSettings, user) {
  await db.collection('general_space_permissions').updateOne(
    { _id: 'general' },
    {
      $set: {
        permissionSettings: {
          ...permissionSettings,
          updatedAt: new Date(),
          updatedBy: user.username,
        },
      },
    },
    { upsert: true }
  );
}

// Helper to get user's teams
async function getUserTeams(db, user) {
  const userIdStr = user._id?.toString();
  const teams = await db.collection('teams')
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
  return teams;
}

// GET /api/projects/[id]/permissions - Fetch permission settings for a project
export async function GET(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Handle General space specially
    if (id === 'general') {
      const permissionSettings = await getGeneralSpacePermissions(db);
      const canManage = ['Admin', 'Console admin'].includes(user.role);

      return NextResponse.json({
        success: true,
        permissionSettings,
        canManage,
        isGeneralSpace: true,
      });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user can access the project
    if (!canAccessProject(user, project)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Return permission settings (managers see full settings, others see limited info)
    const userTeams = await getUserTeams(db, user);
    const canManage = canManagePermissions(user, project, userTeams);

    const permissionSettings = project.permissionSettings || getDefaultPermissionSettings();

    // Populate team names and member details for allowed teams if they exist
    if (permissionSettings.allowedTeams?.length > 0) {
      const allowedTeamIds = [];
      permissionSettings.allowedTeams.forEach(tid => {
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

      permissionSettings.allowedTeamsDetails = teamsData.map(team => {
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

    return NextResponse.json({
      success: true,
      permissionSettings,
      canManage
    });

  } catch (error) {
    console.error('GET /api/projects/[id]/permissions error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/projects/[id]/permissions - Update permission settings for a project
export async function PUT(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Handle General space specially - only Admin/Console admin can modify
    if (id === 'general') {
      if (!['Admin', 'Console admin'].includes(user.role)) {
        return NextResponse.json({ error: 'Access denied: Only Admin and Console admin can modify General space permissions' }, { status: 403 });
      }

      const { permissionSettings } = await req.json();

      if (!permissionSettings) {
        return NextResponse.json({ error: 'Permission settings required' }, { status: 400 });
      }

      // Validate permission settings structure
      const validAccessModes = ['members_only', 'roles_based'];
      if (!validAccessModes.includes(permissionSettings.accessMode)) {
        return NextResponse.json({ error: 'Invalid access mode' }, { status: 400 });
      }

      // Update general space permissions
      await updateGeneralSpacePermissions(db, permissionSettings, user);

      // Log permission change
      try {
        await db.collection('doc_activity_logs').insertOne({
          projectId: 'general',
          action: 'permission_change',
          resourceType: 'general_space',
          resourceName: 'General Space',
          userId: user._id,
          username: user.username,
          timestamp: new Date(),
          metadata: {
            newSettings: permissionSettings,
          },
        });
      } catch (logError) {
        console.error('Failed to log permission change:', logError);
      }

      return NextResponse.json({
        success: true,
        message: 'General space permissions updated successfully',
        permissionSettings,
      });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user can manage permissions
    const userTeams = await getUserTeams(db, user);
    if (!canManagePermissions(user, project, userTeams)) {
      return NextResponse.json({ error: 'Access denied: Only managers can modify permissions' }, { status: 403 });
    }

    const { permissionSettings } = await req.json();

    if (!permissionSettings) {
      return NextResponse.json({ error: 'Permission settings required' }, { status: 400 });
    }

    // Validate permission settings structure
    const validAccessModes = ['members_only', 'roles_based', 'teams_based'];
    if (!validAccessModes.includes(permissionSettings.accessMode)) {
      return NextResponse.json({ error: 'Invalid access mode' }, { status: 400 });
    }

    if (permissionSettings.accessMode === 'roles_based') {
      // Validate allowedRoles
      if (!Array.isArray(permissionSettings.allowedRoles)) {
        return NextResponse.json({ error: 'allowedRoles must be an array' }, { status: 400 });
      }

      // Validate rolePermissions structure
      if (permissionSettings.rolePermissions && typeof permissionSettings.rolePermissions === 'object') {
        const validLevels = ['read', 'write', 'full'];
        const validScopes = ['all', 'own', 'none'];

        for (const [role, perms] of Object.entries(permissionSettings.rolePermissions)) {
          if (perms.level && !validLevels.includes(perms.level)) {
            return NextResponse.json({ error: `Invalid permission level for role ${role}` }, { status: 400 });
          }
          if (perms.readScope && !validScopes.includes(perms.readScope)) {
            return NextResponse.json({ error: `Invalid readScope for role ${role}` }, { status: 400 });
          }
          if (perms.writeScope && !validScopes.includes(perms.writeScope)) {
            return NextResponse.json({ error: `Invalid writeScope for role ${role}` }, { status: 400 });
          }
          if (perms.downloadScope && !validScopes.includes(perms.downloadScope)) {
            return NextResponse.json({ error: `Invalid downloadScope for role ${role}` }, { status: 400 });
          }
        }
      }
    }

    if (permissionSettings.accessMode === 'teams_based') {
      // Validate allowedTeams
      if (!Array.isArray(permissionSettings.allowedTeams)) {
        return NextResponse.json({ error: 'allowedTeams must be an array' }, { status: 400 });
      }

      // Validate teamPermissions structure
      if (permissionSettings.teamPermissions && typeof permissionSettings.teamPermissions === 'object') {
        const validScopes = ['all', 'own', 'none'];

        for (const [teamId, perms] of Object.entries(permissionSettings.teamPermissions)) {
          if (perms.readScope && !validScopes.includes(perms.readScope)) {
            return NextResponse.json({ error: `Invalid readScope for team ${teamId}` }, { status: 400 });
          }
          if (perms.writeScope && !validScopes.includes(perms.writeScope)) {
            return NextResponse.json({ error: `Invalid writeScope for team ${teamId}` }, { status: 400 });
          }
          if (perms.downloadScope && !validScopes.includes(perms.downloadScope)) {
            return NextResponse.json({ error: `Invalid downloadScope for team ${teamId}` }, { status: 400 });
          }
        }
      }
    }

    // Update permission settings
    const updateData = {
      permissionSettings: {
        ...permissionSettings,
        updatedAt: new Date(),
        updatedBy: user.username
      },
      updatedAt: new Date()
    };

    await db.collection('projects').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Log permission change
    try {
      await db.collection('doc_activity_logs').insertOne({
        projectId: id,
        action: 'permission_change',
        resourceType: 'project',
        resourceName: project.name,
        userId: user._id,
        username: user.username,
        timestamp: new Date(),
        metadata: {
          previousSettings: project.permissionSettings,
          newSettings: updateData.permissionSettings
        }
      });
    } catch (logError) {
      console.error('Failed to log permission change:', logError);
    }

    // Fetch updated project
    const updatedProject = await db.collection('projects').findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      success: true,
      message: 'Permissions updated successfully',
      permissionSettings: updatedProject.permissionSettings
    });

  } catch (error) {
    console.error('PUT /api/projects/[id]/permissions error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
