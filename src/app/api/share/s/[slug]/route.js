import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/share/s/:slug
 *      Public endpoint to get project data via share link (no auth required)
 *      Returns project details, sprints, and tasks based on share settings
 *
 * POST /api/share/s/:slug
 *      Record visitor information
 */

function parseUserAgent(ua) {
  const result = { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };

  // Detect browser
  if (ua.includes('Firefox')) result.browser = 'Firefox';
  else if (ua.includes('Edg/')) result.browser = 'Edge';
  else if (ua.includes('Chrome')) result.browser = 'Chrome';
  else if (ua.includes('Safari')) result.browser = 'Safari';
  else if (ua.includes('MSIE') || ua.includes('Trident')) result.browser = 'IE';

  // Detect OS
  if (ua.includes('Win')) result.os = 'Windows';
  else if (ua.includes('Mac')) result.os = 'macOS';
  else if (ua.includes('Linux')) result.os = 'Linux';
  else if (ua.includes('Android')) result.os = 'Android';
  else if (ua.includes('iOS')) result.os = 'iOS';

  // Detect device
  if (/mobile|android|iphone|ipad/i.test(ua)) result.device = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) result.device = 'Tablet';

  return result;
}

export async function GET(request, { params }) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Find the share link
    const shareLink = await db.collection('project_share_links').findOne({ slug, isActive: true });

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found or inactive' }, { status: 404 });
    }

    // Check if link has expired
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: 'Share link has expired', expired: true }, { status: 410 });
    }

    // Get project details
    const project = await db.collection('projects').findOne({ _id: shareLink.projectId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get sprints - separate backlog from sprint sprints
    let sprintsQuery = { projectId: shareLink.projectId };
    const selectedSprintIds = shareLink.settings?.showSprints || [];

    if (selectedSprintIds.length > 0) {
      sprintsQuery._id = { $in: selectedSprintIds.map(id => new ObjectId(id)) };
    }

    const sprints = await db.collection('project_sprints')
      .find(sprintsQuery)
      .sort({ createdAt: 1 })
      .toArray();

    // Get tasks
    const sprintIds = sprints.map(s => s._id.toString());
    let tasksQuery = { projectId: shareLink.projectId };

    if (sprintIds.length > 0) {
      tasksQuery.sprintId = { $in: [...sprintIds.map(id => new ObjectId(id)), null] };
    }

    const tasks = await db.collection('project_tasks')
      .find(tasksQuery)
      .toArray();

    // Process user names based on settings
    let processedTasks = tasks;
    if (!shareLink.settings.showUserNames) {
      processedTasks = tasks.map(task => ({
        ...task,
        assignees: task.assignees ? task.assignees.map(() => ({ anonymous: true })) : [],
        reporter: task.reporter ? { anonymous: true } : null,
      }));
    } else {
      const userIds = new Set();
      tasks.forEach(task => {
        if (task.assignees) task.assignees.forEach(id => userIds.add(id));
        if (task.reporter) userIds.add(task.reporter);
      });

      const users = await db.collection('admin_users')
        .find({ _id: { $in: Array.from(userIds).filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) } })
        .toArray();

      const userMap = new Map(users.map(u => [u._id.toString(), { username: u.username, email: u.email }]));

      processedTasks = tasks.map(task => ({
        ...task,
        assignees: task.assignees?.map(id => userMap.get(id.toString()) || { username: 'Unknown' }) || [],
        reporter: task.reporter ? userMap.get(task.reporter.toString()) || { username: 'Unknown' } : null,
      }));
    }

    // Get visitor count for this link
    const visitCount = await db.collection('project_share_visits').countDocuments({ shareLinkId: shareLink._id });

    // Format response
    const responseData = {
      project: {
        _id: project._id.toString(),
        name: project.name,
        description: project.description,
        status: project.status,
      },
      sprints: sprints.map(s => ({
        _id: s._id.toString(),
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
      })),
      tasks: processedTasks.map(task => ({
        _id: task._id.toString(),
        title: task.title,
        description: shareLink.settings.showDescriptions ? task.description : null,
        type: task.type,
        status: task.status,
        dueDate: shareLink.settings.showDueDates ? task.dueDate : null,
        assignees: task.assignees,
        reporter: task.reporter,
        sprintId: task.sprintId?.toString() || null,
      })),
      shareLink: {
        name: shareLink.name,
        expiresAt: shareLink.expiresAt,
        settings: shareLink.settings,
        visitCount,
      },
      includeProductBoard: shareLink.settings.includeProductBoard !== false,
    };

    return NextResponse.json(responseData);
  } catch (err) {
    console.error('Failed to fetch shared project:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { slug } = await params;
    const { name, email } = await request.json();

    if (!slug) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Find the share link
    const shareLink = await db.collection('project_share_links').findOne({ slug, isActive: true });

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found or inactive' }, { status: 404 });
    }

    // Get visitor info from headers
    const headers = request.headers;
    const userAgent = headers.get('user-agent') || '';
    const forwardedFor = headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'Unknown';

    const uaInfo = parseUserAgent(userAgent);

    // Get approximate location from IP (using a simple method - in production use a geolocation service)
    const location = 'Unknown'; // Would need external API for real location

    // Save visit record
    const visit = {
      shareLinkId: shareLink._id,
      projectId: shareLink.projectId,
      name: name || 'Anonymous',
      email: email || 'Anonymous',
      ip,
      browser: uaInfo.browser,
      os: uaInfo.os,
      device: uaInfo.device,
      location,
      visitedAt: new Date(),
    };

    await db.collection('project_share_visits').insertOne(visit);

    return NextResponse.json({ success: true, visitId: visit._id });
  } catch (err) {
    console.error('Failed to record visitor:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
