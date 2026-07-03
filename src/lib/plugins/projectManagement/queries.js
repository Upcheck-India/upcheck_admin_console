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

/** Maps projectId -> project name for a set of tasks, so list output can
 * show which project each task belongs to without a separate lookup. */
async function resolveProjectNames(db, tasks) {
  const ids = [...new Set(tasks.map(t => t.projectId).filter(Boolean).map(id => id.toString()))];
  if (ids.length === 0) return {};
  const projects = await db.collection('projects')
    .find({ _id: { $in: ids.map(toObjectIdSafe) } })
    .project({ name: 1 })
    .toArray();
  return projects.reduce((acc, p) => {
    acc[p._id.toString()] = p.name;
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

/** One task, formatted as a clear 3-line block instead of a single crammed
 * line — title on its own line, a compact icon-tagged meta line (due /
 * assignee / project, only the fields that apply), and the id last so it
 * doesn't compete for attention with the human-readable parts. */
function formatTaskLine(task, assigneeMap, index, projectMap) {
  const assignees = (task.assignees || []).map(a => assigneeMap[a.toString()] || 'Unknown').join(', ') || 'Unassigned';
  const priorityIcon = PRIORITY_EMOJI[task.priority] || '⚪';
  const prefix = index != null ? `${index + 1}.` : '•';
  const projectName = projectMap ? projectMap[task.projectId?.toString()] : null;

  const meta = [`📅 ${formatDueLabel(task.dueDate)}`, `👤 ${assignees}`];
  if (projectName) meta.push(`📁 ${projectName}`);

  return [
    `${prefix} ${priorityIcon} **${task.title}** *(${task.status})*`,
    `   ${meta.join('   ')}`,
    `   🔗 #${task._id.toString()}`,
  ].join('\n');
}

function buildTaskFilter(userId, extra = {}) {
  const userIdObj = toObjectIdSafe(userId);
  const filter = { assignees: { $in: [userId, userIdObj] }, ...extra };
  return filter;
}

function applyProjectScope(filter, projectIds) {
  if (projectIds && projectIds.length > 0) {
    filter.projectId = { $in: projectIds.map(toObjectIdSafe) };
  }
  return filter;
}

/** Up to `limit` open (not Done) tasks assigned to `userId`, soonest due first. */
export async function getUserTasks(db, userId, { limit = 10, projectIds = [] } = {}) {
  const filter = applyProjectScope(buildTaskFilter(userId, { status: { $ne: 'Done' } }), projectIds);
  const tasks = await db.collection('project_tasks')
    .find(filter)
    .sort({ dueDate: 1, createdAt: -1 })
    .limit(limit)
    .toArray();
  const [assigneeMap, projectMap] = await Promise.all([resolveAssigneeNames(db, tasks), resolveProjectNames(db, tasks)]);
  return { tasks, assigneeMap, projectMap };
}

/** Tasks assigned to `userId` due within the next 48 hours (not yet overdue), not Done. */
export async function getDueSoonTasks(db, userId, { limit = 10, projectIds = [] } = {}) {
  const now = new Date();
  const cutoff = new Date(Date.now() + DUE_SOON_WINDOW_MS);
  const filter = applyProjectScope(
    buildTaskFilter(userId, { status: { $ne: 'Done' }, dueDate: { $gte: now, $lte: cutoff } }),
    projectIds
  );
  const tasks = await db.collection('project_tasks').find(filter).sort({ dueDate: 1 }).limit(limit).toArray();
  const [assigneeMap, projectMap] = await Promise.all([resolveAssigneeNames(db, tasks), resolveProjectNames(db, tasks)]);
  return { tasks, assigneeMap, projectMap };
}

/** Tasks assigned to `userId` whose due date has already passed, not Done. */
export async function getOverdueTasks(db, userId, { limit = 10, projectIds = [] } = {}) {
  const filter = applyProjectScope(
    buildTaskFilter(userId, { status: { $ne: 'Done' }, dueDate: { $ne: null, $lt: new Date() } }),
    projectIds
  );
  const tasks = await db.collection('project_tasks').find(filter).sort({ dueDate: 1 }).limit(limit).toArray();
  const [assigneeMap, projectMap] = await Promise.all([resolveAssigneeNames(db, tasks), resolveProjectNames(db, tasks)]);
  return { tasks, assigneeMap, projectMap };
}

/** Tasks assigned to `userId` that haven't been started yet (backlog-style status), not Done. */
export async function getTodoTasks(db, userId, { limit = 10, projectIds = [] } = {}) {
  const filter = applyProjectScope(
    buildTaskFilter(userId, { status: { $regex: /^(backlog|to ?do|open)$/i } }),
    projectIds
  );
  const tasks = await db.collection('project_tasks').find(filter).sort({ dueDate: 1, createdAt: -1 }).limit(limit).toArray();
  const [assigneeMap, projectMap] = await Promise.all([resolveAssigneeNames(db, tasks), resolveProjectNames(db, tasks)]);
  return { tasks, assigneeMap, projectMap };
}

/** Sprints for one or more projects, most recently created last. If more
 * than one project is linked, each sprint line needs the project name to
 * stay unambiguous — callers pass the resolved projectMap for that. */
export async function getProjectSprints(db, projectIds) {
  const validIds = (Array.isArray(projectIds) ? projectIds : [projectIds]).filter(id => ObjectId.isValid(id));
  if (validIds.length === 0) return [];
  return db.collection('project_sprints')
    .find({ projectId: { $in: validIds.map(id => new ObjectId(id)) } })
    .sort({ createdAt: 1 })
    .toArray();
}

/** A single task by id, or null. */
export async function getTaskById(db, taskId) {
  if (!ObjectId.isValid(taskId)) return null;
  return db.collection('project_tasks').findOne({ _id: new ObjectId(taskId) });
}

/**
 * Projects `user` belongs to — mirrors the membership rules used by
 * GET /api/projects (owner via superManager, direct membership, or
 * role/team-based access grants) so "/projects" never shows a project the
 * web console itself wouldn't list for that user.
 */
export async function getUserProjects(db, user) {
  const userIdStr = user._id.toString();
  const userTeams = await db.collection('teams').find({
    $or: [{ members: userIdStr }, { lead: userIdStr }, { members: user._id }, { lead: user._id }],
  }).toArray();
  const userTeamIds = userTeams.map(t => t._id.toString());
  const teamAccessConditions = userTeamIds.map(teamId => ({
    'permissionSettings.accessMode': 'teams_based',
    'permissionSettings.allowedTeams': teamId,
  }));

  const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
  const query = isAdmin ? {} : {
    $or: [
      { superManager: user.username },
      { 'members.user': user.username },
      { 'permissionSettings.accessMode': 'roles_based', 'permissionSettings.allowedRoles': user.role },
      { 'permissionSettings.accessMode': 'roles_based', 'permissionSettings.allowedRoles': 'Everyone' },
      ...teamAccessConditions,
    ],
  };

  const projects = await db.collection('projects')
    .find(query)
    .project({ name: 1, superManager: 1, members: 1 })
    .sort({ name: 1 })
    .toArray();

  return projects.map(p => ({
    _id: p._id.toString(),
    name: p.name,
    role: p.superManager === user.username
      ? 'Owner'
      : (p.members || []).find(m => m.user === user.username)?.role || null,
  }));
}

/** Resolves a "Proj:<name>" filter token to matching project ids, scoped to
 * `scopeIds` if given (a chat's linked projects) so the filter can never
 * reach outside what's already relevant to the chat. */
export async function resolveProjectIdsByName(db, name, scopeIds = []) {
  const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const query = { name: regex };
  if (scopeIds.length > 0) {
    query._id = { $in: scopeIds.map(toObjectIdSafe) };
  }
  const projects = await db.collection('projects').find(query).project({ name: 1 }).toArray();
  return projects.map(p => p._id.toString());
}

/**
 * Task search backing the #task-mention autocomplete. Scope is
 * intentionally conservative and mirrors the rest of the plugin: if the
 * installing chat is linked to one or more projects, search those
 * projects' tasks by title; otherwise search only the caller's own tasks
 * (assignee or reporter) — never an unscoped cross-project search, since
 * chat participants shouldn't be able to fish for tasks they can't
 * otherwise see.
 */
export async function searchTasksForMention(db, currentUser, config, queryText, { limit = 8 } = {}) {
  const titleFilter = queryText ? { title: { $regex: queryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {};
  const linkedProjectIds = getLinkedProjectIds(config);

  if (linkedProjectIds.length > 0) {
    return db.collection('project_tasks')
      .find({ projectId: { $in: linkedProjectIds.map(toObjectIdSafe) }, ...titleFilter })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
  }

  const userId = currentUser._id.toString();
  const userIdObj = toObjectIdSafe(userId);
  return db.collection('project_tasks')
    .find({
      $or: [{ assignees: { $in: [userId, userIdObj] } }, { reporter: { $in: [userId, userIdObj] } }],
      ...titleFilter,
    })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
}

/** Reads a chat's linked project id(s) from its plugin config, tolerating
 * the old single-`projectId` shape from before multi-project linking. */
export function getLinkedProjectIds(config) {
  if (Array.isArray(config?.projectIds) && config.projectIds.length > 0) {
    return config.projectIds;
  }
  if (config?.projectId) return [config.projectId];
  return [];
}

export { formatTaskLine, formatDueLabel, resolveAssigneeNames, resolveProjectNames, DUE_SOON_WINDOW_MS };
