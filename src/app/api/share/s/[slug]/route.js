import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/share/s/:slug
 *      Public endpoint to get project data via share link (no auth required)
 *      Returns project details, sprints, and tasks based on share settings
 */

export async function GET(request, { params }) {
  try {
    const { slug } = params;

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

    // Get sprints (filtered if settings specify)
    let sprintsQuery = { projectId: shareLink.projectId };
    if (shareLink.settings.showSprints && shareLink.settings.showSprints.length > 0) {
      sprintsQuery._id = { $in: shareLink.settings.showSprints.map(id => new ObjectId(id)) };
    }

    const sprints = await db.collection('project_sprints')
      .find(sprintsQuery)
      .sort({ createdAt: 1 })
      .toArray();

    // Get tasks for these sprints
    const sprintIds = sprints.map(s => s._id);
    let tasksQuery = { projectId: shareLink.projectId };

    if (sprintIds.length > 0) {
      tasksQuery.sprintId = { $in: [...sprintIds, null] }; // Include backlog tasks
    }

    const tasks = await db.collection('project_tasks')
      .find(tasksQuery)
      .toArray();

    // Process user names based on settings
    let processedTasks = tasks;
    if (!shareLink.settings.showUserNames) {
      // Anonymize assignees and reporters
      processedTasks = tasks.map(task => ({
        ...task,
        assignees: task.assignees ? task.assignees.map(() => ({ anonymous: true })) : [],
        reporter: task.reporter ? { anonymous: true } : null,
      }));
    } else {
      // Load user details for assignees and reporters
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
      },
    };

    return NextResponse.json(responseData);
  } catch (err) {
    console.error('Failed to fetch shared project:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
