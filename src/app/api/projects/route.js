import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { canAccessProject } from '../../../lib/projectPermissions';

// Helper to fetch user's teams for permission checking
async function getUserTeams(db, user) {
  const userIdStr = user._id?.toString();
  if (!userIdStr) return [];
  return await db.collection('teams')
    .find({
      $or: [
        { members: userIdStr },
        { lead: userIdStr },
        { members: user._id },
        { lead: user._id },
      ],
    })
    .toArray();
}

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
  // Remove duplicates
  return [...new Set(sanitized)];
}

// GET - Fetch projects
export async function GET(req) {
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

    // Fetch user teams for team-based permission checking
    const userTeams = await getUserTeams(db, user);
    const userTeamIds = userTeams.map(t => t._id?.toString());

    const projectsCollection = db.collection('projects');
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab');
    const tag = searchParams.get('tag');

    // Always filter projects by user permissions unless Admin/Console admin
    const isAdmin = user.role === 'Admin' || user.role === 'Console admin';

    // Fetch all projects based on query
    let query = {};
    if (!isAdmin) {
      // Non-admins can only see projects they have access to
      // Build query to include team-based access
      const teamAccessConditions = userTeamIds.map(teamId => ({
        'permissionSettings.allowedTeams': teamId
      }));

      query = {
        $or: [
          { superManager: user.username },
          { 'members.user': user.username },
          // Role-based access for user's role
          { 'permissionSettings.accessMode': 'roles_based', 'permissionSettings.allowedRoles': user.role },
          { 'permissionSettings.accessMode': 'roles_based', 'permissionSettings.allowedRoles': 'Everyone' },
          // Team-based access for user's teams
          ...teamAccessConditions.map(cond => ({ 'permissionSettings.accessMode': 'teams_based', ...cond }))
        ]
      };
    }

    const allProjects = await projectsCollection.find(query).sort({ createdAt: -1 }).toArray();

    // Filter projects by permission settings (additional validation)
    const accessibleProjects = allProjects.filter(project => canAccessProject(user, project, userTeams));

    // Further filter if 'my' tab specified
    if (tab === 'my' && isAdmin) {
      const myProjects = accessibleProjects.filter(p =>
        p.superManager === user.username || p.members?.some(m => m.user === user.username)
      );
      return NextResponse.json(myProjects);
    }

    // Filter by tag if provided
    if (tag) {
      const sanitizedTag = sanitizeTag(tag);
      if (sanitizedTag) {
        return NextResponse.json(accessibleProjects.filter(p => p.tags?.includes(sanitizedTag)));
      }
    }

    return NextResponse.json(accessibleProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST - Create a new project
export async function POST(req) {
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

    // Restrict interns from creating projects
    if (user.role === 'Intern') {
      return NextResponse.json({ error: 'Forbidden: Interns cannot create projects' }, { status: 403 });
    }

    const { name, description, logo, members: newMembers = [], status = 'active', tags = [] } = await req.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['active', 'ideation', 'paused', 'shelved', 'dismissed'];
    const projectStatus = validStatuses.includes(status) ? status : 'active';

    // Sanitize tags
    const sanitizedTags = sanitizeTags(tags);

    const projectsCollection = db.collection('projects');
    const existingProject = await projectsCollection.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });

    if (existingProject) {
      return NextResponse.json({ error: 'A project with this name already exists' }, { status: 409 });
    }

    // Combine the creator (as Super Manager) with the new members from the request
    const creatorMember = { user: user.username, email: user.email, role: 'Super Manager' };
    const otherMembers = newMembers.filter(m => m.user !== user.username);
    const finalMembers = [creatorMember, ...otherMembers];

    const newProject = {
      name: name.trim(),
      description: description?.trim() || '',
      logo: logo || '',
      status: projectStatus,
      superManager: user.username,
      members: finalMembers,
      tags: sanitizedTags,
      settings: {
        allowContributorsUpdateTasks: true,
        allowContributorsDeleteTasks: false,
        sendNotifications: true,
        sendTaskAssignmentEmails: true,
        sendSprintCreationEmails: true,
        sendProjectInviteEmails: true,
        enableIdeaCanvas: true,
        githubIntegrationEnabled: true,
        trackTaskActivity: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await projectsCollection.insertOne(newProject);
    const createdProject = { _id: result.insertedId, ...newProject };

    return NextResponse.json(createdProject, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
