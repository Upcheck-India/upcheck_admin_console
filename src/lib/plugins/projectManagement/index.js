import { canViewUserData } from '../permissions.js';
import {
  getUserTasks, getDueSoonTasks, getOverdueTasks, getTodoTasks, getProjectSprints, getTaskById,
  formatTaskLine, formatDueLabel, resolveAssigneeNames,
} from './queries.js';

// Resolves a leading "@username" token in a slash command's args to a user
// doc, or null if no mention was given (meaning "myself").
async function resolveTargetUser(db, argsText) {
  const match = argsText.match(/^@(\S+)/);
  if (!match) return null;
  const username = match[1];
  return db.collection('admin_users').findOne({ username: { $regex: `^${username}$`, $options: 'i' } });
}

function renderTaskList(title, tasks, assigneeMap, emptyMessage) {
  if (tasks.length === 0) return emptyMessage;
  const lines = tasks.map((t, i) => formatTaskLine(t, assigneeMap, i));
  return `${title} (${tasks.length}):\n${lines.join('\n')}`;
}

// RBAC note: every command below either (a) only ever reads the calling
// user's own data, or (b) explicitly checks canViewUserData/task
// assignee-or-reporter-or-shared-team before returning another user's data.
// There is no path that returns task/project data without one of these
// checks running first.

async function handleTasks({ db, currentUser, argsText }) {
  const target = await resolveTargetUser(db, argsText);
  const targetUser = target || currentUser;
  const targetId = targetUser._id.toString();

  if (target && !(await canViewUserData(db, currentUser, targetId))) {
    return `🔒 You don't have permission to view @${target.username}'s tasks (you need to share a team with them, or be an admin).`;
  }

  const { tasks, assigneeMap } = await getUserTasks(db, targetId);
  const who = target ? `@${target.username}'s open tasks` : 'Your open tasks';
  return renderTaskList(`📋 ${who}`, tasks, assigneeMap, target ? `📋 @${target.username} has no open tasks.` : '📋 You have no open tasks. 🎉');
}

async function handleTodo({ db, currentUser, argsText }) {
  const target = await resolveTargetUser(db, argsText);
  const targetUser = target || currentUser;
  const targetId = targetUser._id.toString();

  if (target && !(await canViewUserData(db, currentUser, targetId))) {
    return `🔒 You don't have permission to view @${target.username}'s to-do list.`;
  }

  const { tasks, assigneeMap } = await getTodoTasks(db, targetId);
  const who = target ? `@${target.username}'s to-do list` : 'Your to-do list';
  return renderTaskList(`📝 ${who}`, tasks, assigneeMap, target ? `📝 @${target.username} has nothing in their to-do list.` : '📝 Nothing in your to-do list. 🎉');
}

async function handleDueSoon({ db, currentUser }) {
  const { tasks, assigneeMap } = await getDueSoonTasks(db, currentUser._id.toString());
  return renderTaskList('⏰ Due within 48 hours', tasks, assigneeMap, '✅ Nothing due in the next 48 hours.');
}

async function handleOverdue({ db, currentUser }) {
  const { tasks, assigneeMap } = await getOverdueTasks(db, currentUser._id.toString());
  return renderTaskList('🚨 Overdue', tasks, assigneeMap, '✅ Nothing overdue. Great job staying on top of things!');
}

async function handleSprints({ db, config }) {
  if (!config?.projectId) {
    return "ℹ️ This chat's Project Management plugin isn't linked to a project yet. A chat admin can set one from the plugin settings.";
  }
  const sprints = await getProjectSprints(db, config.projectId);
  if (sprints.length === 0) {
    return '📆 No sprints found for the linked project.';
  }
  const lines = sprints.map((s, i) => {
    const start = s.startDate ? new Date(s.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?';
    const end = s.endDate ? new Date(s.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?';
    return `${i + 1}. ${s.name} (${start} – ${end})`;
  });
  return `📆 Sprints (${sprints.length}):\n${lines.join('\n')}`;
}

async function handleTaskDetail({ db, currentUser, argsText }) {
  const taskId = argsText.trim().replace(/^#(task:)?/, '');
  if (!taskId) {
    return 'Usage: /task <taskId> — e.g. /task 6710f2... (you can paste the #<id> shown at the end of any task line)';
  }
  const task = await getTaskById(db, taskId);
  if (!task) {
    return `❓ No task found with id ${taskId}.`;
  }

  const isAssignee = (task.assignees || []).some(a => a.toString() === currentUser._id.toString());
  const isReporter = task.reporter?.toString() === currentUser._id.toString();
  let allowed = isAssignee || isReporter;
  if (!allowed) {
    for (const assigneeId of task.assignees || []) {
      if (await canViewUserData(db, currentUser, assigneeId.toString())) { allowed = true; break; }
    }
  }
  if (!allowed) {
    return `🔒 You don't have permission to view task ${taskId}.`;
  }

  const assigneeMap = await resolveAssigneeNames(db, [task]);
  const assignees = (task.assignees || []).map(a => assigneeMap[a.toString()] || 'Unknown').join(', ') || 'Unassigned';
  return [
    `📌 ${task.title}  (#${task._id.toString()})`,
    `Status: ${task.status} • Priority: ${task.priority || 'Medium'} • Type: ${task.type || 'Feature'}`,
    `${formatDueLabel(task.dueDate)} • Story Points: ${task.storyPoints || 0}`,
    `Assignees: ${assignees}`,
    task.description ? `\n${task.description.slice(0, 400)}` : '',
  ].filter(Boolean).join('\n');
}

// Deliberately defined last so it can reference the full command list below
// without a forward-declaration — see plugin.commands.
async function handleHelp() {
  const lines = projectManagementPlugin.commands.map(c => `${c.usage}\n   ${c.description}`);
  return `📋 Project Management — available commands:\n${lines.join('\n\n')}`;
}

const projectManagementPlugin = {
  id: 'project-management',
  name: 'Project Management',
  description: "Fetch your (or a teammate's) tasks, sprints, and near-deadline items right from chat using slash commands.",
  icon: '📋',
  commands: [
    {
      name: 'tasks',
      usage: '/tasks [@username]',
      description: "List open tasks assigned to you, or a teammate's (if you share a team with them, or you're an admin).",
      handler: handleTasks,
    },
    {
      name: 'todo',
      usage: '/todo [@username]',
      description: "List tasks that haven't been started yet (backlog/to-do status).",
      handler: handleTodo,
    },
    {
      name: 'duesoon',
      usage: '/duesoon',
      description: 'List your tasks due within the next 48 hours (not yet overdue).',
      handler: handleDueSoon,
    },
    {
      name: 'overdue',
      usage: '/overdue',
      description: 'List your tasks whose due date has already passed.',
      handler: handleOverdue,
    },
    {
      name: 'sprints',
      usage: '/sprints',
      description: "List sprints for this chat's linked project.",
      handler: handleSprints,
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
