import { ObjectId } from 'mongodb';
import { decrypt } from './encryption.js';
import { sendPushNotification } from './pushNotifications.js';

const BOT_ID = "600000000000000000000001";
const BOT_USERNAME = "upcheck_admin_bot";
const BOT_NAME = "Upcheck Admin Bot";

const tools = [
  {
    type: "function",
    function: {
      name: "list_meetings",
      description: "List upcoming meetings and calendar events in the workspace. Returns titles, descriptions, timings, and participant lists. Can be filtered by teamName/teamId or search query.",
      parameters: {
        type: "object",
        properties: {
          teamName: { type: "string", description: "Optional name of the team to filter meetings for (e.g. 'Dairy app')" },
          teamId: { type: "string", description: "Optional team ID to filter meetings for" },
          search: { type: "string", description: "Optional query to search meetings by title or description" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_meeting",
      description: "Schedule a new meeting/event on behalf of the user. Requires title, description, startTime (ISO string), duration (minutes), provider ('google_meet' | 'zoom'), and participants list (emails). Only users with permissions can schedule meetings. Interns are forbidden.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the meeting" },
          description: { type: "string", description: "Brief overview of what the meeting covers" },
          startTime: { type: "string", description: "ISO 8601 string representing the start time of the meeting" },
          duration: { type: "integer", description: "Meeting duration in minutes (between 1 and 300)" },
          provider: { type: "string", enum: ["google_meet", "zoom"], default: "google_meet" },
          joinUrl: { type: "string", description: "The Google Meet or Zoom join link provided by the user. Prompt the user for this link first." },
          sendEmailInvites: { type: "boolean", description: "Whether to send invites/notifications to participants. Defaults to true." },
          participants: {
            type: "array",
            items: { type: "string" },
            description: "List of participant email addresses"
          }
        },
        required: ["title", "description", "startTime", "duration"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_teams",
      description: "Retrieve list of all active teams and departments in the organization. Accessible to Admins and Console admins only.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "list_users",
      description: "View the workspace directory of users, containing usernames, display names, emails, roles, and departments. Supports optional search query.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Optional name or username to search/filter users" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "List active projects in the organization that the user has access to. Returns project names, description, manager, and tags.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "list_announcements",
      description: "List active announcements in the organization that are visible to the user. Returns title, content, whether it is important, and creator details.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "create_announcement",
      description: "Publish a new workspace announcement on behalf of the user. Only Admins and Console admins are permitted. Requires title, content, and optionally isImportant (boolean) to trigger a broadcast notification.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the announcement" },
          content: { type: "string", description: "Detailed content message of the announcement" },
          isImportant: { type: "boolean", description: "Whether to mark as important and broadcast to all users" }
        },
        required: ["title", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_project_details",
      description: "Get complete details of a specific project, including managers, members list, allowed teams, and settings.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "The ID of the project to retrieve details for" }
        },
        required: ["projectId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_sprints",
      description: "List all sprints for a specific project. Returns sprint names, start/end dates, status, and IDs.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "The ID of the project to list sprints for" }
        },
        required: ["projectId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_tasks",
      description: "Query, search, list, and filter project tasks across the workspace. Can be filtered by projectId, sprintId, assigneeId (user ID), status, priority, or nearDeadline.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Optional project ID to filter tasks" },
          sprintId: { type: "string", description: "Optional sprint ID to filter tasks" },
          assigneeId: { type: "string", description: "Optional user ID to filter tasks assigned to a specific person" },
          status: { type: "string", description: "Optional status to filter (e.g. 'Backlog', 'To Do', 'In Progress', 'Done')" },
          priority: { type: "string", description: "Optional priority (e.g. 'Low', 'Medium', 'High', 'Critical')" },
          nearDeadline: { type: "boolean", description: "Optional. If true, returns only tasks with deadlines in the next 7 days." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_workspace_workload",
      description: "Get a workload summary of all workspace users, including the names and counts of tasks and projects assigned to each user.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_announcement",
      description: "Edit/update an existing workspace announcement. Requires announcementId and updated fields. Accessible to Admins and Console admins only.",
      parameters: {
        type: "object",
        properties: {
          announcementId: { type: "string", description: "The ID of the announcement to update" },
          title: { type: "string", description: "Optional updated title" },
          content: { type: "string", description: "Optional updated content" },
          isImportant: { type: "boolean", description: "Optional updated flag for importance" }
        },
        required: ["announcementId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_announcement",
      description: "Delete an existing workspace announcement. Requires announcementId. Accessible to Admins and Console admins only.",
      parameters: {
        type: "object",
        properties: {
          announcementId: { type: "string", description: "The ID of the announcement to delete" }
        },
        required: ["announcementId"]
      }
    }
  }
];

async function executeTool(name, args, db, currentUser) {
  try {
    const userRole = currentUser.role || 'Member';
    const userName = currentUser.firstName || currentUser.lastName
      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim()
      : currentUser.username;
    const userEmail = currentUser.email;

    if (name === 'list_meetings') {
      const { teamId, teamName, search } = args;
      let query = {};

      if (teamId || teamName) {
        let teamMemberEmails = [];
        let teamDoc = null;
        if (teamName) {
          teamDoc = await db.collection('teams').findOne({ name: { $regex: teamName, $options: 'i' } });
        } else if (teamId && ObjectId.isValid(teamId)) {
          teamDoc = await db.collection('teams').findOne({ _id: new ObjectId(teamId) });
        }

        if (teamDoc) {
          const memberIds = [
            ...(teamDoc.members || []),
            teamDoc.lead
          ].filter(Boolean).map(id => id.toString());

          const memberUsers = await db.collection('admin_users').find({
            _id: { $in: memberIds.map(id => {
              try { return new ObjectId(id); } catch { return id; }
            }) }
          }).toArray();
          teamMemberEmails = memberUsers.map(u => u.email).filter(Boolean);

          query.$or = [
            { teams: teamDoc._id.toString() },
            { teams: teamDoc.name },
            { participants: { $in: teamMemberEmails } },
            { host: { $in: teamMemberEmails } }
          ];
        } else {
          query = { teams: teamName || teamId };
        }
      } else {
        query.$or = [
          { hostId: currentUser._id.toString() },
          { host: userEmail },
          { participants: userEmail }
        ];
      }

      // Filter upcoming/recent meetings (starts from 24h ago) by default unless specifically searching for a team
      if (!teamId && !teamName) {
        query.startTime = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
      }

      if (search) {
        const searchRegex = { $regex: search, $options: 'i' };
        if (query.$or) {
          query = {
            $and: [
              { $or: query.$or },
              { $or: [ { title: searchRegex }, { description: searchRegex } ] }
            ]
          };
        } else {
          query.$or = [ { title: searchRegex }, { description: searchRegex } ];
        }
      }

      const events = await db.collection('events')
        .find(query)
        .sort({ startTime: 1 })
        .limit(15)
        .toArray();

      return JSON.stringify(events.map(e => ({
        id: e._id.toString(),
        title: e.title,
        description: e.description ? (e.description.length > 80 ? e.description.substring(0, 77) + '...' : e.description) : '',
        startTime: e.startTime,
        duration: e.duration,
        host: e.host,
        joinUrl: e.joinUrl || e.zoomMeetingUrl,
        teams: e.teams || [],
        momDocuments: e.momDocuments || [],
        participants: e.participants ? (e.participants.length > 3 ? [...e.participants.slice(0, 3), `+${e.participants.length - 3} more`] : e.participants) : []
      })));
    }

    if (name === 'create_meeting') {
      if (userRole === 'Intern') {
        return JSON.stringify({ error: `Permission Denied: Users with role '${userRole}' are not authorized to create meetings.` });
      }

      const { title, description, startTime, duration, provider = 'google_meet', participants = [], joinUrl, sendEmailInvites = true } = args;
      
      const durationInt = parseInt(duration, 10);
      if (isNaN(durationInt) || durationInt < 1 || durationInt > 300) {
        return JSON.stringify({ error: "Duration must be between 1 and 300 minutes." });
      }

      if (new Date(startTime) < new Date()) {
        return JSON.stringify({ error: "Start time must be in the future." });
      }

      const eventId = new ObjectId();
      const auditLog = `\n\nUpcheck Admin Bot has created a meeting on behalf of ${userName} (${userEmail}).`;
      
      const eventData = {
        _id: eventId,
        title,
        description: description + auditLog,
        host: userEmail,
        hostId: currentUser._id.toString(),
        duration: durationInt,
        participants: [...new Set([...participants, userEmail])],
        teams: [],
        startTime: new Date(startTime),
        endTime: new Date(new Date(startTime).getTime() + durationInt * 60000),
        sendNotification: !!sendEmailInvites,
        createdAt: new Date(),
        provider: provider,
        joinUrl: joinUrl || `https://meet.google.com/${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`
      };

      await db.collection('events').insertOne(eventData);

      // Trigger push notifications if enabled
      if (sendEmailInvites) {
        try {
          const recipients = await db.collection('admin_users').find({
            email: { $in: eventData.participants.filter(email => email.toLowerCase() !== userEmail.toLowerCase()) }
          }).toArray();

          for (const u of recipients) {
            sendPushNotification(
              u._id.toString(),
              '📅 New Meeting Scheduled',
              `${title} on ${new Date(startTime).toLocaleString()}`,
              { type: 'new_meeting', meetingId: eventId.toString() }
            ).catch(() => {});
          }
        } catch (pushErr) {
          console.error('Trigger meeting push error:', pushErr);
        }
      }

      return JSON.stringify({
        success: true,
        message: `Upcheck Admin Bot has successfully created a meeting on behalf of ${userName}.`,
        meetingId: eventId.toString(),
        joinUrl: eventData.joinUrl,
        startTime: eventData.startTime
      });
    }

    if (name === 'list_teams') {
      if (userRole !== 'Admin' && userRole !== 'Console admin') {
        return JSON.stringify({ error: `Permission Denied: Users with role '${userRole}' are not authorized to view workspace teams.` });
      }

      const teams = await db.collection('teams').find({}).toArray();
      return JSON.stringify(teams.map(t => ({
        id: t._id.toString(),
        name: t.name,
        description: t.description,
        lead: t.lead?.toString(),
        members: t.members?.map(m => m.toString()) || []
      })));
    }

    if (name === 'list_users') {
      const search = args.search?.trim();
      let query = { role: { $ne: 'bot' } };
      if (search) {
        query.$or = [
          { username: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      const users = await db.collection('admin_users')
        .find(query, { projection: { password: 0, sessionToken: 0, backupCodes: 0 } })
        .limit(search ? 15 : 12)
        .toArray();

      const totalCount = await db.collection('admin_users').countDocuments({ role: { $ne: 'bot' } });

      return JSON.stringify({
        users: users.map(u => ({
          id: u._id.toString(),
          username: u.username,
          name: u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username,
          email: u.email,
          role: u.role,
          department: u.department,
          jobTitle: u.jobTitle
        })),
        totalWorkspaceUsers: totalCount,
        message: users.length < totalCount && !search ? "Showing first 12 users. Use search parameter to filter if looking for a specific user." : undefined
      });
    }

    if (name === 'list_projects') {
      const isAdmin = userRole === 'Admin' || userRole === 'Console admin';
      let query = {};
      if (!isAdmin) {
        // Fetch teams user belongs to
        const userTeams = await db.collection('teams').find({
          $or: [
            { members: currentUser._id.toString() },
            { lead: currentUser._id.toString() },
            { members: currentUser._id },
            { lead: currentUser._id }
          ]
        }).toArray();
        const userTeamIds = userTeams.map(t => t._id.toString());
        const teamAccessConditions = userTeamIds.map(teamId => ({
          'permissionSettings.allowedTeams': teamId
        }));
        query = {
          $or: [
            { superManager: currentUser.username },
            { 'members.user': currentUser.username },
            { 'permissionSettings.accessMode': 'roles_based', 'permissionSettings.allowedRoles': currentUser.role },
            { 'permissionSettings.accessMode': 'roles_based', 'permissionSettings.allowedRoles': 'Everyone' },
            ...teamAccessConditions.map(cond => ({ 'permissionSettings.accessMode': 'teams_based', ...cond }))
          ]
        };
      }
      const projects = await db.collection('projects').find(query).sort({ createdAt: -1 }).limit(8).toArray();
      return JSON.stringify(projects.map(p => ({
        id: p._id.toString(),
        name: p.name,
        description: p.description ? (p.description.length > 80 ? p.description.substring(0, 77) + '...' : p.description) : '',
        superManager: p.superManager,
        status: p.status || 'active',
        tags: p.tags || []
      })));
    }

    if (name === 'list_announcements') {
      const isAdmin = userRole === 'Admin' || userRole === 'Console admin';
      let query = {};
      if (!isAdmin) {
        const userTeams = await db.collection('teams').find({
          $or: [
            { members: currentUser._id.toString() },
            { lead: currentUser._id.toString() },
            { members: currentUser._id },
            { lead: currentUser._id }
          ]
        }, { projection: { _id: 1 } }).toArray();
        const userTeamIds = userTeams.map(t => t._id.toString());
        query = {
          $or: [
            { teams: { $exists: false } },
            { teams: { $size: 0 } },
            { teams: null },
            { teams: { $in: userTeamIds } }
          ]
        };
      }
      const announcements = await db.collection('announcements').find(query).sort({ createdAt: -1 }).limit(5).toArray();
      return JSON.stringify(announcements.map(a => ({
        id: a._id.toString(),
        title: a.title,
        content: a.content ? (a.content.length > 80 ? a.content.substring(0, 77) + '...' : a.content) : '',
        isImportant: a.isImportant,
        createdBy: a.createdBy?.name || a.createdBy?.username || 'Unknown',
        createdAt: a.createdAt
      })));
    }

    if (name === 'create_announcement') {
      if (userRole !== 'Admin' && userRole !== 'Console admin') {
        return JSON.stringify({ error: `Permission Denied: Users with role '${userRole}' are not authorized to publish announcements.` });
      }
      const { title, content, isImportant = false } = args;
      if (!title || !title.trim()) {
        return JSON.stringify({ error: "Title is required." });
      }
      if (!content || !content.trim()) {
        return JSON.stringify({ error: "Content is required." });
      }

      const auditLog = `\n\nUpcheck Admin Bot has published this announcement on behalf of ${userName} (${userEmail}).`;
      const announcement = {
        title: title.trim(),
        content: content.trim() + auditLog,
        isImportant: !!isImportant,
        teams: [],
        buttonText: '',
        buttonUrl: '',
        buttonColor: '',
        createdBy: {
          id: currentUser._id.toString(),
          username: currentUser.username,
          email: userEmail,
          name: userName,
        },
        createdAt: new Date(),
        reactions: [],
        dismissedBy: [],
      };

      const result = await db.collection('announcements').insertOne(announcement);

      if (isImportant) {
        try {
          const users = await db.collection('admin_users').find({ role: { $ne: 'bot' } }).toArray();
          for (const u of users) {
            sendPushNotification(
              u._id.toString(),
              `📢 ${title.trim()}`,
              content.trim().length > 100 ? `${content.trim().substring(0, 100)}...` : content.trim(),
              { type: 'announcement', announcementId: result.insertedId.toString() }
            ).catch(() => {});
          }
        } catch (pushErr) {
          console.error('Trigger announcement push error:', pushErr);
        }
      }

      return JSON.stringify({
        success: true,
        message: `Upcheck Admin Bot has successfully published the announcement on behalf of ${userName}.`,
        announcementId: result.insertedId.toString(),
        title: announcement.title
      });
    }

    if (name === 'get_project_details') {
      const { projectId } = args;
      if (!projectId || !ObjectId.isValid(projectId)) {
        return JSON.stringify({ error: "Invalid or missing projectId parameter" });
      }
      const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
      if (!project) {
        return JSON.stringify({ error: "Project not found" });
      }
      return JSON.stringify({
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        superManager: project.superManager,
        status: project.status || 'active',
        members: project.members || [],
        permissionSettings: project.permissionSettings || {},
        createdAt: project.createdAt
      });
    }

    if (name === 'list_sprints') {
      const { projectId } = args;
      if (!projectId || !ObjectId.isValid(projectId)) {
        return JSON.stringify({ error: "Invalid or missing projectId parameter" });
      }
      const sprints = await db.collection('project_sprints')
        .find({ projectId: new ObjectId(projectId) })
        .sort({ createdAt: 1 })
        .toArray();
      return JSON.stringify(sprints.map(s => ({
        id: s._id.toString(),
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        status: s.status || 'active'
      })));
    }

    if (name === 'query_tasks') {
      const { projectId, sprintId, assigneeId, status, priority, nearDeadline } = args;
      let query = {};
      
      if (projectId && ObjectId.isValid(projectId)) {
        query.projectId = new ObjectId(projectId);
      }
      if (sprintId) {
        if (ObjectId.isValid(sprintId)) {
          query.sprintId = new ObjectId(sprintId);
        } else if (sprintId === 'null' || sprintId === 'none') {
          query.sprintId = { $exists: false };
        }
      }
      if (assigneeId) {
        query.assignees = new ObjectId(assigneeId);
      }
      if (status) {
        query.status = { $regex: new RegExp(`^${status}$`, 'i') };
      }
      if (priority) {
        query.priority = { $regex: new RegExp(`^${priority}$`, 'i') };
      }
      if (nearDeadline) {
        const next7Days = new Date();
        next7Days.setDate(next7Days.getDate() + 7);
        query.dueDate = { $gte: new Date(), $lte: next7Days };
      }

      const tasks = await db.collection('project_tasks')
        .find(query)
        .sort({ dueDate: 1, createdAt: -1 })
        .limit(20)
        .toArray();

      // Resolve usernames of assignees
      const assigneeIds = [...new Set(tasks.flatMap(t => t.assignees || []).filter(Boolean))];
      const users = await db.collection('admin_users')
        .find({ _id: { $in: assigneeIds } })
        .project({ firstName: 1, lastName: 1, username: 1, email: 1 })
        .toArray();
      const userMap = users.reduce((acc, u) => {
        acc[u._id.toString()] = u.firstName || u.lastName 
          ? `${u.firstName || ''} ${u.lastName || ''}`.trim() 
          : u.username;
        return acc;
      }, {});

      return JSON.stringify(tasks.map(t => ({
        id: t._id.toString(),
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        storyPoints: t.storyPoints || 0,
        description: t.description ? (t.description.length > 50 ? t.description.substring(0, 47) + '...' : t.description) : '',
        assignees: (t.assignees || []).map(id => userMap[id.toString()] || id.toString())
      })));
    }

    if (name === 'get_workspace_workload') {
      const tasks = await db.collection('project_tasks').find({}).toArray();
      const projects = await db.collection('projects').find({}).toArray();
      const projectMap = projects.reduce((acc, p) => {
        acc[p._id.toString()] = p.name;
        return acc;
      }, {});

      const users = await db.collection('admin_users').find({ role: { $ne: 'bot' } }).toArray();
      const userMap = users.reduce((acc, u) => {
        acc[u._id.toString()] = {
          username: u.username,
          name: u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username,
          email: u.email
        };
        return acc;
      }, {});

      const workload = {};
      
      for (const t of tasks) {
        const assignees = t.assignees || [];
        const projectIdStr = t.projectId?.toString();
        const projectName = projectMap[projectIdStr] || 'Unknown Project';
        
        for (const assigneeId of assignees) {
          const idStr = assigneeId.toString();
          if (!workload[idStr]) {
            const userDetail = userMap[idStr] || { name: 'Unknown User', username: 'unknown' };
            workload[idStr] = {
              userId: idStr,
              name: userDetail.name,
              username: userDetail.username,
              email: userDetail.email,
              taskCount: 0,
              projectsCount: 0,
              projects: new Set(),
              tasks: []
            };
          }
          workload[idStr].taskCount++;
          workload[idStr].projects.add(projectName);
          workload[idStr].tasks.push({
            title: t.title,
            status: t.status,
            projectName: projectName
          });
        }
      }

      const result = Object.values(workload).map(w => ({
        userId: w.userId,
        name: w.name,
        username: w.username,
        email: w.email,
        taskCount: w.taskCount,
        projectsCount: w.projects.size,
        projects: Array.from(w.projects)
      }));

      return JSON.stringify(result);
    }

    if (name === 'edit_announcement') {
      if (userRole !== 'Admin' && userRole !== 'Console admin') {
        return JSON.stringify({ error: `Permission Denied: Users with role '${userRole}' are not authorized to edit announcements.` });
      }

      const { announcementId, title, content, isImportant } = args;
      if (!announcementId || !ObjectId.isValid(announcementId)) {
        return JSON.stringify({ error: "Invalid or missing announcementId" });
      }

      const updateFields = { updatedAt: new Date() };
      if (title && title.trim()) updateFields.title = title.trim();
      if (content && content.trim()) {
        const auditLog = `\n\nUpcheck Admin Bot has edited this announcement on behalf of ${userName} (${userEmail}).`;
        updateFields.content = content.trim() + auditLog;
      }
      if (isImportant !== undefined) updateFields.isImportant = !!isImportant;

      const result = await db.collection('announcements').findOneAndUpdate(
        { _id: new ObjectId(announcementId) },
        { $set: updateFields },
        { returnDocument: 'after' }
      );

      if (!result) {
        return JSON.stringify({ error: "Announcement not found" });
      }

      if (isImportant) {
        try {
          const users = await db.collection('admin_users').find({ role: { $ne: 'bot' } }).toArray();
          for (const u of users) {
            sendPushNotification(
              u._id.toString(),
              `📢 Updated: ${updateFields.title || result.title}`,
              (updateFields.content || result.content).replace(/\n\nUpcheck[\s\S]*$/, '').substring(0, 100) + '...',
              { type: 'announcement', announcementId }
            ).catch(() => {});
          }
        } catch (e) {}
      }

      return JSON.stringify({
        success: true,
        message: `Upcheck Admin Bot has successfully updated the announcement.`,
        announcementId
      });
    }

    if (name === 'delete_announcement') {
      if (userRole !== 'Admin' && userRole !== 'Console admin') {
        return JSON.stringify({ error: `Permission Denied: Users with role '${userRole}' are not authorized to delete announcements.` });
      }

      const { announcementId } = args;
      if (!announcementId || !ObjectId.isValid(announcementId)) {
        return JSON.stringify({ error: "Invalid or missing announcementId" });
      }

      const result = await db.collection('announcements').deleteOne({ _id: new ObjectId(announcementId) });
      if (result.deletedCount === 0) {
        return JSON.stringify({ error: "Announcement not found" });
      }

      return JSON.stringify({
        success: true,
        message: `Upcheck Admin Bot has successfully deleted the announcement.`
      });
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (err) {
    console.error(`Execute tool error [${name}]:`, err);
    return JSON.stringify({ error: `Failed to execute action: ${err.message}` });
  }
}

async function updateBotMessage(db, chatType, botMsgId, bodyText, isFinished = false) {
  const collection = chatType === 'dm' ? 'chat_messages' : (chatType === 'group' ? 'group_chat_messages' : 'team_messages');
  await db.collection(collection).updateOne(
    { _id: botMsgId },
    { 
      $set: { 
        body: bodyText,
        status: isFinished ? 'sent' : 'streaming',
        updatedAt: new Date()
      } 
    }
  );
}

async function releaseLock(db, chatType, chatId) {
  const collection = chatType === 'dm' ? 'conversations' : (chatType === 'group' ? 'group_chats' : 'teams');
  await db.collection(collection).updateOne(
    { _id: new ObjectId(chatId) },
    { $set: { isBotProcessing: false } }
  );
}

export async function triggerBotAgent({ chatType, chatId, body, currentUser, db }) {
  const botMsgId = new ObjectId();
  
  try {
    // 1. Fetch user's Groq key
    const userDoc = await db.collection('admin_users').findOne({ _id: currentUser._id });
    const decryptedKey = userDoc?.groqApiKey ? decrypt(userDoc.groqApiKey) : null;

    if (!decryptedKey) {
      // Insert failure message
      const errorText = "Hello! I am Upcheck Admin Bot. Before I can process your requests, please submit your Groq API key in the chat settings.";
      if (chatType === 'dm') {
        await db.collection('chat_messages').insertOne({
          _id: botMsgId,
          conversationId: chatId,
          senderId: BOT_ID,
          recipientId: currentUser._id.toString(),
          body: errorText,
          type: "text",
          status: "sent",
          createdAt: new Date(),
        });
      } else {
        const collection = chatType === 'group' ? 'group_chat_messages' : 'team_messages';
        await db.collection(collection).insertOne({
          _id: botMsgId,
          [chatType === 'group' ? 'groupId' : 'teamId']: chatId,
          senderId: BOT_ID,
          senderName: BOT_NAME,
          senderUsername: BOT_USERNAME,
          body: errorText,
          type: "text",
          createdAt: new Date(),
          readBy: [{ userId: BOT_ID, readAt: new Date() }],
          deletedFor: [],
          deletedForEveryone: false,
        });
      }
      await releaseLock(db, chatType, chatId);
      return;
    }

    // 2. Insert streaming placeholder
    if (chatType === 'dm') {
      await db.collection('chat_messages').insertOne({
        _id: botMsgId,
        conversationId: chatId,
        senderId: BOT_ID,
        recipientId: currentUser._id.toString(),
        body: "",
        type: "text",
        status: "streaming",
        createdAt: new Date(),
      });
    } else {
      const collection = chatType === 'group' ? 'group_chat_messages' : 'team_messages';
      await db.collection(collection).insertOne({
        _id: botMsgId,
        [chatType === 'group' ? 'groupId' : 'teamId']: chatId,
        senderId: BOT_ID,
        senderName: BOT_NAME,
        senderUsername: BOT_USERNAME,
        body: "",
        type: "text",
        status: "streaming",
        createdAt: new Date(),
        readBy: [{ userId: BOT_ID, readAt: new Date() }],
        deletedFor: [],
        deletedForEveryone: false,
      });
    }

    // 3. Build chat history
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    const isoStr = now.toISOString();

    const userName = (currentUser.firstName || currentUser.lastName)
      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim()
      : currentUser.username;

    let messages = [
      {
        role: "system",
        content: `You are Upcheck Admin Bot — an intelligent, professional AI workspace assistant built into the Upcheck platform. You help employees manage meetings, access team info, explore projects, read announcements, and stay organized.

## Current Context
- **Today's Date**: ${dateStr}
- **Current Time**: ${timeStr} IST
- **ISO Timestamp**: ${isoStr}
- **Current User**: ${userName} (${currentUser.email})
- **User Role**: ${currentUser.role || 'Member'}
- **Chat Channel**: ${chatType === 'dm' ? 'Direct Message' : chatType === 'group' ? 'Group Chat' : 'Team Chat'}

## Your Role & Behavior
- You execute actions **strictly on behalf of ${userName}**. When you create or modify something, always attribute it: "Upcheck Admin Bot has [action] on behalf of ${userName}."
- You inherit the **exact permissions of ${userName}**. If their role doesn't allow an action, you must refuse it firmly but politely.
- You are **context-aware of time**. Use today's date to clarify relative times like "tomorrow", "next week", "this Friday".

## Formatting Rules (CRITICAL)
- **NEVER use markdown tables** (e.g. \`| Col 1 | Col 2 |\`). Tables do not fit on mobile screens and break the chat interface.
- Instead, present structured data using clear lists (e.g. bold field name followed by its value), bullet points, or clean sections.
- Keep responses concise, clear, and straight to the point unless the user requests more detail.

## Write Tool Guardrails & Confirmation Flow
- **CRITICAL**: When the user asks to create/schedule a meeting (\`create_meeting\`) or publish an announcement (\`create_announcement\`), you **MUST NOT** call the tool immediately.
- First, present a clear preview of the parameters you plan to use (Title, Date, Time, Duration, Provider, Participants).
- Ask the user to confirm: "Would you like me to schedule this meeting? Do you want to send email invites to the participants?"
- Ask the user to provide the Google Meet or Zoom join link. Do not generate a fake placeholder link.
- Only invoke the write tool once the user explicitly confirms (e.g. "Confirm", "Yes", "Go ahead") and provides the link details.

## Tool Usage Guidelines
- **Read-only tools** (\`list_meetings\`, \`list_users\`, \`list_teams\`, \`list_projects\`, \`list_announcements\`): Call these freely to find requested information.
- For \`list_meetings\`, you can filter by \`teamName\` (e.g., 'Dairy app') to find meetings attended by a team's members. Always check this first if the user queries a team's meetings.
- When a tool returns an error, explain it clearly and suggest next steps.

## Permission Rules
- Intern: ❌ Denied create_meeting, list_teams, create_announcement
- Member: ✅ Allowed create_meeting | ❌ Denied list_teams, create_announcement
- Admin / Console admin: ✅ Allowed all`
      }
    ];

    if (chatType === 'dm') {
      const history = await db.collection('chat_messages')
        .find({ conversationId: chatId, status: { $ne: 'streaming' } })
        .sort({ createdAt: -1 })
        .limit(8)
        .toArray();
      
      history.reverse().forEach((m, idx) => {
        let content = m.body || '';
        // Compress older messages in context history to save tokens
        if (idx < history.length - 2 && content.length > 250) {
          content = content.replace(/\|[\s\S]*?\|/g, '[Table omitted]').substring(0, 250) + '... (truncated)';
        }
        messages.push({
          role: m.senderId === BOT_ID ? 'assistant' : 'user',
          content
        });
      });
    } else if (chatType === 'group') {
      const history = await db.collection('group_chat_messages')
        .find({ groupId: chatId, status: { $ne: 'streaming' } })
        .sort({ createdAt: -1 })
        .limit(8)
        .toArray();
      
      history.reverse().forEach((m, idx) => {
        let content = m.body || '';
        if (idx < history.length - 2 && content.length > 250) {
          content = content.replace(/\|[\s\S]*?\|/g, '[Table omitted]').substring(0, 250) + '... (truncated)';
        }
        messages.push({
          role: m.senderId === BOT_ID ? 'assistant' : 'user',
          content
        });
      });
    } else {
      const history = await db.collection('team_messages')
        .find({ teamId: chatId, status: { $ne: 'streaming' } })
        .sort({ createdAt: -1 })
        .limit(8)
        .toArray();
      
      history.reverse().forEach((m, idx) => {
        let content = m.body || '';
        if (idx < history.length - 2 && content.length > 250) {
          content = content.replace(/\|[\s\S]*?\|/g, '[Table omitted]').substring(0, 250) + '... (truncated)';
        }
        messages.push({
          role: m.senderId === BOT_ID ? 'assistant' : 'user',
          content
        });
      });
    }

    // Agent completions invocation loop (max 3 loops to avoid recursion limits)
    let loopCount = 0;
    let keepRunning = true;
    let finalContent = "";

    while (keepRunning && loopCount < 3) {
      loopCount++;
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${decryptedKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages,
          tools,
          stream: true
        })
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(`Groq Completions failed: ${errorMsg}`);
      }

      // Stream chunks parser
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let streamBuffer = "";
      let done = false;
      let toolCalls = [];
      let lastDbWrite = Date.now();

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n');
          streamBuffer = lines.pop(); // keep last chunk in buffer

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine === 'data: [DONE]') continue;
            if (cleanLine.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(cleanLine.substring(6));
                const delta = parsed.choices?.[0]?.delta;
                if (delta) {
                  if (delta.content) {
                    finalContent += delta.content;
                    // Throttled DB write
                    if (Date.now() - lastDbWrite > 1000) {
                      await updateBotMessage(db, chatType, botMsgId, finalContent);
                      lastDbWrite = Date.now();
                    }
                  }
                  if (delta.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index;
                      if (!toolCalls[idx]) {
                        toolCalls[idx] = {
                          id: tc.id,
                          type: tc.type,
                          function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' }
                        };
                      } else {
                        if (tc.id) toolCalls[idx].id = tc.id;
                        if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                        if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                      }
                    }
                  }
                }
              } catch (e) {}
            }
          }
        }
      }

      // Clean up tools list (filter undefined entries)
      toolCalls = toolCalls.filter(Boolean);

      if (toolCalls.length > 0) {
        // Build assistant message representing the tool calls
        const assistantMessage = {
          role: "assistant",
          content: finalContent || null,
          tool_calls: toolCalls.map(tc => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments
            }
          }))
        };
        messages.push(assistantMessage);

        // Execute tools
        for (const tc of toolCalls) {
          const toolStatusMap = {
            list_meetings:      { emoji: '📅', label: 'Loading upcoming meetings...' },
            create_meeting:     { emoji: '📆', label: 'Scheduling a new meeting...' },
            list_teams:         { emoji: '👥', label: 'Loading workspace teams...' },
            list_users:         { emoji: '👤', label: 'Querying user directory...' },
            list_projects:      { emoji: '📁', label: 'Loading workspace projects...' },
            list_announcements: { emoji: '📢', label: 'Retrieving announcements...' },
            create_announcement:{ emoji: '📣', label: 'Publishing announcement...' },
          };
          const statusInfo = toolStatusMap[tc.function.name] || { emoji: '⚙️', label: `Running ${tc.function.name}...` };
          // Store as structured status JSON so the UI can render a special card
          const statusMsg = `__BOT_STATUS__${JSON.stringify(statusInfo)}`;
          await updateBotMessage(db, chatType, botMsgId, statusMsg);

          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch (pErr) {
            console.error('Failed to parse tool arguments:', pErr);
          }

          const toolResult = await executeTool(tc.function.name, parsedArgs, db, currentUser);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: toolResult
          });
        }
      } else {
        // No tool calls means final text response is achieved
        keepRunning = false;
      }
    }

    // Final DB Write
    await updateBotMessage(db, chatType, botMsgId, finalContent, true);

    // Update last message in parent channel
    if (chatType === 'dm') {
      await db.collection('conversations').updateOne(
        { _id: new ObjectId(chatId) },
        { $set: { lastMessageAt: new Date() } }
      );
      // Push notification
      sendPushNotification(
        currentUser._id.toString(),
        BOT_NAME,
        finalContent,
        { type: 'chat_message', conversationId: chatId }
      ).catch(() => {});
    } else if (chatType === 'group') {
      await db.collection('group_chats').updateOne(
        { _id: new ObjectId(chatId) },
        { $set: { lastMessagePreview: finalContent.substring(0, 80), updatedAt: new Date() } }
      );
      // Group push notifications
      try {
        const group = await db.collection('group_chats').findOne({ _id: new ObjectId(chatId) });
        const uniqueRecipients = (group.members || [])
          .map(m => m.toString())
          .filter(id => id !== BOT_ID && id !== currentUser._id.toString());
        for (const id of uniqueRecipients) {
          sendPushNotification(id, `${BOT_NAME} in [${group.name}]`, finalContent, { type: 'group_message', groupId: chatId }).catch(() => {});
        }
      } catch (e) {}
    } else {
      await db.collection('teams').updateOne(
        { _id: new ObjectId(chatId) },
        { $set: { lastMessagePreview: finalContent.substring(0, 80), lastMessageAt: new Date() } }
      );
      // Team push notifications
      try {
        const team = await db.collection('teams').findOne({ _id: new ObjectId(chatId) });
        const uniqueRecipients = (team.members || [])
          .map(m => m.toString())
          .filter(id => id !== BOT_ID && id !== currentUser._id.toString());
        for (const id of uniqueRecipients) {
          sendPushNotification(id, `${BOT_NAME} in #${team.name}`, finalContent, { type: 'team_message', teamId: chatId }).catch(() => {});
        }
      } catch (e) {}
    }

  } catch (err) {
    console.error('Upcheck Admin Bot Trigger Error:', err);
    // Write error message
    const errorMsg = `Upcheck Admin Bot Error: Failed to generate response. (${err.message})`;
    await updateBotMessage(db, chatType, botMsgId, errorMsg, true);
  } finally {
    await releaseLock(db, chatType, chatId);
  }
}
