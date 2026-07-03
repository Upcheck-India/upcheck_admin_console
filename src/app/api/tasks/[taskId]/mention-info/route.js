import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/auth';
import { canViewTask } from '../../../../../lib/plugins/permissions.js';
import { getTaskById, resolveAssigneeNames, formatDueLabel } from '../../../../../lib/plugins/projectManagement/queries.js';

// GET — resolves a #task-mention chip when tapped/clicked into a quick-info
// summary. Uses the exact same permission check as the /task slash command
// (canViewTask) so the two surfaces never disagree about who can see what.
export async function GET(req, { params }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, db } = auth;

    const { taskId } = await params;
    const task = await getTaskById(db, taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!(await canViewTask(db, user, task))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const assigneeMap = await resolveAssigneeNames(db, [task]);
    const assignees = (task.assignees || []).map(a => assigneeMap[a.toString()] || 'Unknown');

    return NextResponse.json({
      task: {
        _id: task._id.toString(),
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority || 'Medium',
        type: task.type || 'Feature',
        storyPoints: task.storyPoints || 0,
        dueDate: task.dueDate || null,
        dueLabel: formatDueLabel(task.dueDate),
        assignees,
        projectId: task.projectId?.toString() || null,
      },
    });
  } catch (error) {
    console.error('Failed to resolve task mention:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
