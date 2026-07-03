import { canViewUserData, canViewTask } from '../permissions.js';
import {
  getUserTasks, getDueSoonTasks, getOverdueTasks, getTodoTasks, getProjectSprints, getTaskById,
  getUserProjects, resolveProjectIdsByName, getLinkedProjectIds,
  formatTaskLine, formatDueLabel, resolveAssigneeNames, resolveProjectNames,
} from './queries.js';

// Resolves a leading "@username" token in a slash command's args to a user
// doc, or null if no mention was given (meaning "myself").
async function resolveTargetUser(db, argsText) {
  const match = argsText.match(/@(\S+)/);
  if (!match) return null;
  const username = match[1];
  return db.collection('admin_users').findOne({ username: { $regex: `^${username}$`, $options: 'i' } });
}

// Pulls a "Proj:<name>" (or "Proj:\"multi word name\"") token out of the
// args text, order-independent with the "@username" token — e.g. both
// "/tasks @JohnDoe Proj:UpcheckApp" and "/tasks Proj:UpcheckApp @JohnDoe"
// work. Returns the remaining text (with the tag stripped) so the rest of
// the parsing (the @mention) doesn't need to know about it.
function parseProjectTag(argsText) {
  const match = argsText.match(/proj:("[^"]+"|\S+)/i);
  if (!match) return { projectName: null, rest: argsText };
  let name = match[1];
  if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
  const rest = (argsText.slice(0, match.index) + argsText.slice(match.index + match[0].length)).trim();
  return { projectName: name, rest };
}

// Resolves the effective project scope for a command: an explicit
// "Proj:<name>" tag narrows (and must resolve to a real project, scoped to
// the chat's linked projects if it has any); otherwise the chat's linked
// projects apply as the default scope, or no scope at all if unlinked.
async function resolveProjectScope(db, config, projectName) {
  const linkedProjectIds = getLinkedProjectIds(config);
  if (!projectName) {
    return { projectIds: linkedProjectIds, label: '', error: null };
  }
  const matched = await resolveProjectIdsByName(db, projectName, linkedProjectIds);
  if (matched.length === 0) {
    const scopeNote = linkedProjectIds.length > 0 ? ' among this chat\'s linked projects' : '';
    return { projectIds: [], label: '', error: `❓ No project matching **${projectName}**${scopeNote}.` };
  }
  return { projectIds: matched, label: ` in **${projectName}**`, error: null };
}

function renderTaskList(title, tasks, assigneeMap, projectMap, emptyMessage) {
  if (tasks.length === 0) return emptyMessage;
  const lines = tasks.map((t, i) => formatTaskLine(t, assigneeMap, i, projectMap));
  return `**${title}** _(${tasks.length})_\n\n${lines.join('\n\n')}`;
}

// RBAC note: every command below either (a) only ever reads the calling
// user's own data, or (b) explicitly checks canViewUserData/task
// assignee-or-reporter-or-shared-team before returning another user's data.
// There is no path that returns task/project data without one of these
// checks running first.

async function handleTasks({ db, currentUser, argsText, config }) {
  const { projectName, rest } = parseProjectTag(argsText);
  const target = await resolveTargetUser(db, rest);
  const targetUser = target || currentUser;
  const targetId = targetUser._id.toString();

  if (target && !(await canViewUserData(db, currentUser, targetId))) {
    return `🔒 You don't have permission to view @${target.username}'s tasks (you need to share a team with them, or be an admin).`;
  }

  const scope = await resolveProjectScope(db, config, projectName);
  if (scope.error) return scope.error;

  const { tasks, assigneeMap, projectMap } = await getUserTasks(db, targetId, { projectIds: scope.projectIds });
  const who = target ? `@${target.username}'s open tasks` : 'Your open tasks';
  const empty = target ? `📋 @${target.username} has no open tasks${scope.label}.` : `📋 You have no open tasks${scope.label}. 🎉`;
  return renderTaskList(`📋 ${who}${scope.label}`, tasks, assigneeMap, projectMap, empty);
}

async function handleTodo({ db, currentUser, argsText, config }) {
  const { projectName, rest } = parseProjectTag(argsText);
  const target = await resolveTargetUser(db, rest);
  const targetUser = target || currentUser;
  const targetId = targetUser._id.toString();

  if (target && !(await canViewUserData(db, currentUser, targetId))) {
    return `🔒 You don't have permission to view @${target.username}'s to-do list.`;
  }

  const scope = await resolveProjectScope(db, config, projectName);
  if (scope.error) return scope.error;

  const { tasks, assigneeMap, projectMap } = await getTodoTasks(db, targetId, { projectIds: scope.projectIds });
  const who = target ? `@${target.username}'s to-do list` : 'Your to-do list';
  const empty = target ? `📝 @${target.username} has nothing in their to-do list${scope.label}.` : `📝 Nothing in your to-do list${scope.label}. 🎉`;
  return renderTaskList(`📝 ${who}${scope.label}`, tasks, assigneeMap, projectMap, empty);
}

async function handleDueSoon({ db, currentUser, argsText, config }) {
  const { projectName } = parseProjectTag(argsText);
  const scope = await resolveProjectScope(db, config, projectName);
  if (scope.error) return scope.error;

  const { tasks, assigneeMap, projectMap } = await getDueSoonTasks(db, currentUser._id.toString(), { projectIds: scope.projectIds });
  return renderTaskList(`⏰ Due within 48 hours${scope.label}`, tasks, assigneeMap, projectMap, `✅ Nothing due in the next 48 hours${scope.label}.`);
}

async function handleOverdue({ db, currentUser, argsText, config }) {
  const { projectName } = parseProjectTag(argsText);
  const scope = await resolveProjectScope(db, config, projectName);
  if (scope.error) return scope.error;

  const { tasks, assigneeMap, projectMap } = await getOverdueTasks(db, currentUser._id.toString(), { projectIds: scope.projectIds });
  return renderTaskList(`🚨 Overdue${scope.label}`, tasks, assigneeMap, projectMap, `✅ Nothing overdue${scope.label}. Great job staying on top of things!`);
}

async function handleSprints({ db, config, argsText }) {
  const linkedProjectIds = getLinkedProjectIds(config);
  if (linkedProjectIds.length === 0) {
    return "ℹ️ This chat's Project Management plugin isn't linked to a project yet. A chat admin can link one from the plugin settings.";
  }

  const { projectName } = parseProjectTag(argsText);
  const scope = await resolveProjectScope(db, config, projectName);
  if (scope.error) return scope.error;
  const projectIds = scope.projectIds.length > 0 ? scope.projectIds : linkedProjectIds;

  const sprints = await getProjectSprints(db, projectIds);
  if (sprints.length === 0) {
    return `📆 No sprints found${scope.label || ' for the linked project(s)'}.`;
  }

  const projectMap = linkedProjectIds.length > 1 ? await resolveProjectNames(db, sprints.map(s => ({ projectId: s.projectId }))) : {};
  const lines = sprints.map((s, i) => {
    const start = s.startDate ? new Date(s.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?';
    const end = s.endDate ? new Date(s.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?';
    const projectTag = projectMap[s.projectId?.toString()] ? ` — 📁 ${projectMap[s.projectId.toString()]}` : '';
    return `${i + 1}. **${s.name}**${projectTag}\n   📅 ${start} – ${end}`;
  });
  return `**📆 Sprints**${scope.label} _(${sprints.length})_\n\n${lines.join('\n\n')}`;
}

async function handleProjects({ db, currentUser, argsText }) {
  const target = await resolveTargetUser(db, argsText);
  const targetUser = target || currentUser;

  if (target && !(await canViewUserData(db, currentUser, target._id.toString()))) {
    return `🔒 You don't have permission to view @${target.username}'s projects.`;
  }

  const projects = await getUserProjects(db, targetUser);
  const who = target ? `@${target.username}'s projects` : 'Your projects';
  if (projects.length === 0) {
    return target ? `📁 @${target.username} isn't a member of any projects.` : "📁 You aren't a member of any projects.";
  }

  const lines = projects.map((p, i) => `${i + 1}. **${p.name}**${p.role ? `\n   👤 ${p.role}` : ''}`);
  return `**📁 ${who}** _(${projects.length})_\n\n${lines.join('\n\n')}`;
}

async function handleTaskDetail({ db, currentUser, argsText }) {
  const taskId = argsText.trim().replace(/^#(task:)?/, '');
  if (!taskId) {
    return 'Usage: `/task <taskId>` — e.g. `/task 6710f2...` (you can paste the #id shown at the end of any task line).';
  }
  const task = await getTaskById(db, taskId);
  if (!task) {
    return `❓ No task found with id ${taskId}.`;
  }

  if (!(await canViewTask(db, currentUser, task))) {
    return `🔒 You don't have permission to view task ${taskId}.`;
  }

  const [assigneeMap, projectMap] = await Promise.all([
    resolveAssigneeNames(db, [task]),
    resolveProjectNames(db, [task]),
  ]);
  const assignees = (task.assignees || []).map(a => assigneeMap[a.toString()] || 'Unknown').join(', ') || 'Unassigned';
  const projectName = projectMap[task.projectId?.toString()];

  return [
    `📌 **${task.title}**`,
    `   🏷️ ${task.status} · ${task.priority || 'Medium'} priority · ${task.type || 'Feature'}`,
    `   📅 ${formatDueLabel(task.dueDate)}   ⭐ ${task.storyPoints || 0} pts`,
    `   👤 ${assignees}`,
    projectName ? `   📁 ${projectName}` : null,
    `   🔗 #${task._id.toString()}`,
    task.description ? `\n${task.description.slice(0, 400)}` : null,
  ].filter(Boolean).join('\n');
}

// Deliberately defined last so it can reference the full command list below
// without a forward-declaration — see plugin.commands.
async function handleHelp() {
  const lines = projectManagementPlugin.commands.map(c => `**${c.usage}**\n   ${c.description}`);
  return `**📋 Project Management — commands**\n\n${lines.join('\n\n')}`;
}

const projectManagementPlugin = {
  id: 'project-management',
  name: 'Project Management',
  description: "Fetch your (or a teammate's) tasks, sprints, and projects right from chat using slash commands.",
  icon: '📋',
  commands: [
    {
      name: 'tasks',
      usage: '/tasks [@username] [Proj:<name>]',
      description: "List open tasks assigned to you, or a teammate's (if you share a team with them, or you're an admin). Optionally filter to one project.",
      handler: handleTasks,
    },
    {
      name: 'todo',
      usage: '/todo [@username] [Proj:<name>]',
      description: "List tasks that haven't been started yet (backlog/to-do status).",
      handler: handleTodo,
    },
    {
      name: 'duesoon',
      usage: '/duesoon [Proj:<name>]',
      description: 'List your tasks due within the next 48 hours (not yet overdue).',
      handler: handleDueSoon,
    },
    {
      name: 'overdue',
      usage: '/overdue [Proj:<name>]',
      description: 'List your tasks whose due date has already passed.',
      handler: handleOverdue,
    },
    {
      name: 'sprints',
      usage: '/sprints [Proj:<name>]',
      description: "List sprints for this chat's linked project(s).",
      handler: handleSprints,
    },
    {
      name: 'projects',
      usage: '/projects [@username]',
      description: "List the projects you (or a teammate) belong to.",
      handler: handleProjects,
    },
    {
      name: 'task',
      usage: '/task <taskId>',
      description: 'Show full details for a specific task by id (the #id shown at the end of any task line).',
      handler: handleTaskDetail,
    },
    {
      name: 'help',
      usage: '/help',
      description: 'List every Project Management command and what it does.',
      handler: handleHelp,
    },
  ],
};

export default projectManagementPlugin;
