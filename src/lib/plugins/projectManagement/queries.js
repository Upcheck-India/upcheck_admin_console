import { ObjectId } from 'mongodb';

const DUE_SOON_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours, explicit and
// documented since the codebase otherwise has three disagreeing
// definitions of "near deadline" (UI: <=2 calendar days, leaderboard:
// strictly overdue, bot agent: 7-day window) — see plugin design notes.

function toObjectIdSafe(id) {
  try { return new ObjectId(id); } catch { return id; }
}

async function resolveAssigneeNames(db, tasks) {
  const ids = [...new Set(tasks.flatMap(t => t.assignees || []).filter(Boolean))];
  if (ids.length === 0) return {};
  const users = await db.collection('admin_users')
    .find({ _id: { $in: ids.map(toObjectIdSafe) } })
    .project({ firstName: 1, lastName: 1, username: 1 })
    .toArray();
  return users.reduce((acc, u) => {
    acc[u._id.toString()] = u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username;
    return acc;
  }, {});
}

const PRIORITY_EMOJI = { Urgent: '🔴', High: '🟠', Medium: '🟡', Low: '🟢' };

function formatDueLabel(dueDate) {
  if (!dueDate) return 'No due date';
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.round((new Date(due.toDateString()) - new Date(now.toDateString())) / 86400000);
  const dateStr = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d (${dateStr})`;
  if (diffDays === 0) return `Due today (${dateStr})`;
  if (diffDays === 1) return `Due tomorrow (${dateStr})`;
  return `Due ${dateStr}`;
}

function formatTaskLine(task, assigneeMap, index) {
  const assignees = (task.assignees || []).map(a => assigneeMap[a.toString()] || 'Unknown').join(', ') || 'Unassigned';
  const priorityIcon = PRIORITY_EMOJI[task.priority] || '⚪';
  const prefix = index != null ? `${index + 1}.` : '•';
  return `${prefix} ${priorityIcon} ${task.title}\n   ${task.status} • ${formatDueLabel(task.dueDate)} • ${assignees} • #${task._id.toString()}`;
}

/** Up to `limit` open (not Done) tasks assigned to `userId`, soonest due first. */
export async function getUserTasks(db, userId, { limit = 10 } = {}) {
  const userIdObj = toObjectIdSafe(userId);
  const tasks = await db.collection('project_tasks')
    .find({ assignees: { $in: [userId, userIdObj] }, status: { $ne: 'Done' } })
    .sort({ dueDate: 1, createdAt: -1 })
    .limit(limit)
    .toArray();
  const assigneeMap = await resolveAssigneeNames(db, tasks);
  return { tasks, assigneeMap };
}

/** Tasks assigned to `userId` due within the next 48 hours (not yet overdue), not Done. */
export async function getDueSoonTasks(db, userId, { limit = 10 } = {}) {
  const userIdObj = toObjectIdSafe(userId);
  const now = new Date();
  const cutoff = new Date(Date.now() + DUE_SOON_WINDOW_MS);
  const tasks = await db.collection('project_tasks')
    .find({
      assignees: { $in: [userId, userIdObj] },
      status: { $ne: 'Done' },
      dueDate: { $gte: now, $lte: cutoff },
    })
    .sort({ dueDate: 1 })
    .limit(limit)
    .toArray();
  const assigneeMap = await resolveAssigneeNames(db, tasks);
  return { tasks, assigneeMap };
}

/** Tasks assigned to `userId` whose due date has already passed, not Done. */
export async function getOverdueTasks(db, userId, { limit = 10 } = {}) {
  const userIdObj = toObjectIdSafe(userId);
  const tasks = await db.collection('project_tasks')
    .find({
      assignees: { $in: [userId, userIdObj] },
      status: { $ne: 'Done' },
      dueDate: { $ne: null, $lt: new Date() },
    })
    .sort({ dueDate: 1 })
    .limit(limit)
    .toArray();
  const assigneeMap = await resolveAssigneeNames(db, tasks);
  return { tasks, assigneeMap };
}

/** Tasks assigned to `userId` that haven't been started yet (backlog-style status), not Done. */
export async function getTodoTasks(db, userId, { limit = 10 } = {}) {
  const userIdObj = toObjectIdSafe(userId);
  const tasks = await db.collection('project_tasks')
    .find({
      assignees: { $in: [userId, userIdObj] },
      status: { $regex: /^(backlog|to ?do|open)$/i },
    })
    .sort({ dueDate: 1, createdAt: -1 })
    .limit(limit)
    .toArray();
  const assigneeMap = await resolveAssigneeNames(db, tasks);
  return { tasks, assigneeMap };
}

/** Sprints for a specific project, most recently created last. */
export async function getProjectSprints(db, projectId) {
  if (!ObjectId.isValid(projectId)) return [];
  return db.collection('project_sprints')
    .find({ projectId: new ObjectId(projectId) })
    .sort({ createdAt: 1 })
    .toArray();
}

/** A single task by id, or null. */
export async function getTaskById(db, taskId) {
  if (!ObjectId.isValid(taskId)) return null;
  return db.collection('project_tasks').findOne({ _id: new ObjectId(taskId) });
}

export { formatTaskLine, formatDueLabel, resolveAssigneeNames, DUE_SOON_WINDOW_MS };
