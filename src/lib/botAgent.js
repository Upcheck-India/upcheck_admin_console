import { ObjectId } from 'mongodb';
import { decrypt } from './encryption.js';
import { sendPushNotification } from './pushNotifications.js';
import { sendEmail } from './email.js';

const BOT_ID = "600000000000000000000001";
const BOT_USERNAME = "upcheck_admin_bot";
const BOT_NAME = "Upcheck Admin Bot";

const tools = [
  {
    type: "function",
    function: {
      name: "list_meetings",
      description: "List meetings. By default only returns upcoming/recent meetings (from 24h ago onwards) to prevent clutter.",
      parameters: {
        type: "object",
        properties: {
          teamName: { type: "string", description: "Filter by team name (e.g. 'Dairy app')" },
          teamId: { type: "string", description: "Filter by team ID" },
          search: { type: "string", description: "Search keyword in title/description" },
          includePast: { type: "boolean", description: "Set true to include past meetings (prior to 24h ago)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_meeting",
      description: "Schedule a meeting. Call ONLY after user preview & confirmation.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title" },
          description: { type: "string", description: "Description" },
          startTime: { type: "string", description: "ISO startTime" },
          duration: { type: "integer", description: "Duration in minutes" },
          provider: { type: "string", enum: ["google_meet", "zoom"] },
          joinUrl: { type: "string", description: "Google Meet or Zoom link provided by user" },
          sendEmailInvites: { type: "boolean", description: "Send invites (default true)" },
          participants: { type: "array", items: { type: "string" }, description: "Participant emails" }
        },
        required: ["title", "description", "startTime", "duration"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_teams",
      description: "List active teams. Accessible to Admins/Console admins only.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "list_users",
      description: "View workspace users. Supports optional search query.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search by username/name" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "List accessible projects.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "list_announcements",
      description: "List visible announcements.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "create_announcement",
      description: "Create an announcement. Admins/Console admins only.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title" },
          content: { type: "string", description: "Content" },
          isImportant: { type: "boolean", description: "Broadcast push notification" }
        },
        required: ["title", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_project_details",
      description: "Get details (members, permitted teams/roles) of a project.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID" }
        },
        required: ["projectId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_sprints",
      description: "List sprints of a project.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID" }
        },
        required: ["projectId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_tasks",
      description: "Query and filter project tasks by project, sprint, assignee, status, priority, or deadline.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Filter by project ID" },
          sprintId: { type: "string", description: "Filter by sprint ID or 'null' for backlog" },
          assigneeId: { type: "string", description: "Filter by assignee ID" },
          status: { type: "string", description: "Filter by status" },
          priority: { type: "string", description: "Filter by priority" },
          nearDeadline: { type: "boolean", description: "True to get tasks due in 7 days" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_workspace_workload",
      description: "Get counts of tasks/projects per user across workspace.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_announcement",
      description: "Edit announcement. Admins/Console admins only.",
      parameters: {
        type: "object",
        properties: {
          announcementId: { type: "string", description: "Announcement ID" },
          title: { type: "string", description: "Updated title" },
          content: { type: "string", description: "Updated content" },
          isImportant: { type: "boolean", description: "Updated flag for push" }
        },
        required: ["announcementId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_announcement",
      description: "Delete announcement. Admins/Console admins only.",
      parameters: {
        type: "object",
        properties: {
          announcementId: { type: "string", description: "Announcement ID" }
        },
        required: ["announcementId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_project_leaderboard",
      description: "Get project leaderboard. Omit projectId for overall standings.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Optional project ID" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_meetings",
      description: "Delete one or more meetings by their IDs. Call ONLY after user preview & confirmation.",
      parameters: {
        type: "object",
        properties: {
          meetingIds: {
            type: "array",
            items: { type: "string" },
            description: "List of meeting IDs to delete"
          }
        },
        required: ["meetingIds"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_meeting",
      description: "Modify/postpone an existing meeting. Call ONLY after user preview & confirmation.",
      parameters: {
        type: "object",
        properties: {
          meetingId: { type: "string", description: "The ID of the meeting to update" },
          title: { type: "string", description: "Updated title" },
          description: { type: "string", description: "Updated description" },
          startTime: { type: "string", description: "Updated start time (ISO string) - postpone timing" },
          duration: { type: "integer", description: "Updated duration in minutes" },
          joinUrl: { type: "string", description: "Updated join link" },
          provider: { type: "string", enum: ["google_meet", "zoom"] },
          participants: { type: "array", items: { type: "string" }, description: "Updated participant list of emails" },
          status: { type: "string", enum: ["scheduled", "in_progress", "completed", "cancelled"] }
        },
        required: ["meetingId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_email_broadcast",
      description: "Send an email broadcast to specific users or teams. Admins/Console admins only. Call ONLY after user preview & confirmation.",
      parameters: {
        type: "object",
        properties: {
          recipients: {
            type: "object",
            description: "Target recipients configuration",
            properties: {
              emails: { type: "array", items: { type: "string" }, description: "Specific email addresses" },
              usernames: { type: "array", items: { type: "string" }, description: "Specific usernames" },
              teamNames: { type: "array", items: { type: "string" }, description: "Specific team names (all members of these teams will receive the email)" }
            }
          },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body content" }
        },
        required: ["subject", "body"]
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
      const { teamId, teamName, search, includePast = false } = args;
      let query = {};

      // 1. Build Host/Participant/Team filter
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

      // 2. Build Time filter (Default: only recent/upcoming starting 24h ago)
      let timeConditions = null;
      if (!includePast) {
        const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const cutoffStr = cutoffDate.toISOString();
        timeConditions = {
          $or: [
            { startTime: { $gte: cutoffDate } },
            { startTime: { $gte: cutoffStr } }
          ]
        };
      }

      // 3. Build Search filter
      let searchConditions = null;
      if (search) {
        const searchRegex = { $regex: search, $options: 'i' };
        searchConditions = {
          $or: [
            { title: searchRegex },
            { description: searchRegex }
          ]
        };
      }

      // 4. Combine all conditions using $and to prevent parameter overwriting
      const andConditions = [];
      if (query.$or) {
        andConditions.push({ $or: query.$or });
      } else if (Object.keys(query).length > 0) {
        andConditions.push(query);
      }
      if (timeConditions) {
        andConditions.push(timeConditions);
      }
      if (searchConditions) {
        andConditions.push(searchConditions);
      }

      let finalQuery = {};
      if (andConditions.length > 0) {
        finalQuery = { $and: andConditions };
      }

      const events = await db.collection('events')
        .find(finalQuery)
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
      if (!projectId) {
        return JSON.stringify({ error: "Invalid or missing projectId parameter" });
      }
      const queryIds = [projectId];
      if (ObjectId.isValid(projectId)) queryIds.push(new ObjectId(projectId));

      const project = await db.collection('projects').findOne({ _id: { $in: queryIds } });
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
      if (!projectId) {
        return JSON.stringify({ error: "Invalid or missing projectId parameter" });
      }
      const queryIds = [projectId];
      if (ObjectId.isValid(projectId)) queryIds.push(new ObjectId(projectId));

      const sprints = await db.collection('project_sprints')
        .find({ projectId: { $in: queryIds } })
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
      
      if (projectId) {
        const pIds = [projectId];
        if (ObjectId.isValid(projectId)) pIds.push(new ObjectId(projectId));
        query.projectId = { $in: pIds };
      }
      if (sprintId) {
        if (sprintId === 'null' || sprintId === 'none') {
          query.sprintId = { $exists: false };
        } else {
          const sIds = [sprintId];
          if (ObjectId.isValid(sprintId)) sIds.push(new ObjectId(sprintId));
          query.sprintId = { $in: sIds };
        }
      }
      if (assigneeId) {
        const uIds = [assigneeId];
        if (ObjectId.isValid(assigneeId)) uIds.push(new ObjectId(assigneeId));
        query.assignees = { $in: uIds };
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
        .find({ _id: { $in: assigneeIds.map(id => {
          try { return new ObjectId(id); } catch { return id; }
        }) } })
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

    if (name === 'get_project_leaderboard') {
      const { projectId } = args;

      // 1. Resolve accessible projects
      const isAdmin = userRole === 'Admin' || userRole === 'Console admin';
      let projectsQuery = {};
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
        projectsQuery = {
          $or: [
            { superManager: currentUser.username },
            { 'members.user': currentUser.username },
            { 'permissionSettings.accessMode': 'roles_based', 'permissionSettings.allowedRoles': userRole },
            { 'permissionSettings.accessMode': 'roles_based', 'permissionSettings.allowedRoles': 'Everyone' },
            { 'permissionSettings.accessMode': 'teams_based', 'permissionSettings.allowedTeams': { $in: userTeamIds } }
          ]
        };
      }

      let projects = [];
      if (projectId) {
        if (!ObjectId.isValid(projectId)) {
          return JSON.stringify({ error: "Invalid projectId format" });
        }
        const proj = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
        if (!proj) {
          return JSON.stringify({ error: "Project not found" });
        }
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
          const isManager = proj.superManager === currentUser.username || proj.members?.some(m => m.user === currentUser.username && m.role === 'Project Manager');
          const isMember = proj.members?.some(m => m.user === currentUser.username);
          const hasRoleAccess = proj.permissionSettings?.accessMode === 'roles_based' && (proj.permissionSettings.allowedRoles?.includes(userRole) || proj.permissionSettings.allowedRoles?.includes('Everyone'));
          const hasTeamAccess = proj.permissionSettings?.accessMode === 'teams_based' && proj.permissionSettings.allowedTeams?.some(tId => userTeamIds.includes(tId));
          if (!isManager && !isMember && !hasRoleAccess && !hasTeamAccess) {
            return JSON.stringify({ error: "Forbidden: You do not have access to this project's leaderboard" });
          }
        }
        projects = [proj];
      } else {
        projects = await db.collection('projects').find(projectsQuery).toArray();
      }

      if (projects.length === 0) {
        return JSON.stringify({ leaderboard: [], message: "No accessible projects found." });
      }

      const projectIds = projects.map(p => p._id);

      const tasks = await db.collection('project_tasks').find({ projectId: { $in: projectIds } }).toArray();
      const customBadges = await db.collection('project_custom_badges').find({
        $or: [
          { projectId: { $in: projectIds } },
          { projectExclusive: { $ne: true } }
        ]
      }).toArray();
      const grantedBadges = await db.collection('project_member_badges').find({ projectId: { $in: projectIds } }).toArray();

      const allUserIds = new Set();
      tasks.forEach(t => {
        t.assignees?.forEach(uid => allUserIds.add(new ObjectId(uid)));
        if (t.reporter) allUserIds.add(new ObjectId(t.reporter));
      });
      const resolvedUsers = await db.collection('admin_users')
        .find({ _id: { $in: Array.from(allUserIds) } }, { projection: { username: 1, firstName: 1, lastName: 1 } })
        .toArray();
      const userMap = new Map(resolvedUsers.map(u => [u._id.toString(), u.username]));
      const userDisplayMap = new Map(resolvedUsers.map(u => [
        u.username,
        u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username
      ]));

      const membersSet = new Set();
      projects.forEach(p => {
        if (p.superManager) membersSet.add(p.superManager);
        p.members?.forEach(m => { if (m.user) membersSet.add(m.user); });
      });
      resolvedUsers.forEach(u => { if (u.username) membersSet.add(u.username); });

      const stats = {};
      membersSet.forEach(username => {
        stats[username] = {
          username,
          name: userDisplayMap.get(username) || username,
          tasksCompleted: 0,
          storyPointsCompleted: 0,
          tasksCompletedOnTime: 0,
          tasksCompletedEarly: 0,
          totalTasksWithDueDate: 0,
          commentsCount: 0,
          bugTasksCompleted: 0,
          points: 0,
          badges: [],
          reopenedTasksCount: 0,
          overdueTasksCount: 0,
          completedTasksList: [],
          commentsList: []
        };
      });

      tasks.forEach(task => {
        const isDone = task.status === 'Done';
        const assigneesUsernames = task.assignees?.map(uid => userMap.get(uid.toString())).filter(Boolean) || [];

        task.comments?.forEach(comment => {
          const commenter = comment.userName || comment.authorName;
          if (commenter && stats[commenter]) {
            stats[commenter].commentsList.push({
              createdAt: new Date(comment.createdAt),
              text: comment.text || '',
              taskAssignees: assigneesUsernames,
              taskId: task._id.toString()
            });
          }
        });

        let reopenedCount = 0;
        task.activity?.forEach(act => {
          if (act.type === 'status_change') {
            const statusChange = act.changes?.find(c => c.field === 'status');
            if (statusChange && statusChange.from === 'Done' && statusChange.to !== 'Done') {
              reopenedCount += 1;
            }
          }
        });

        if (reopenedCount > 0) {
          assigneesUsernames.forEach(username => {
            if (stats[username]) {
              stats[username].reopenedTasksCount += reopenedCount;
            }
          });
        }

        if (task.status !== 'Done' && task.dueDate) {
          const dueDate = new Date(task.dueDate);
          if (dueDate < new Date()) {
            assigneesUsernames.forEach(username => {
              if (stats[username]) {
                stats[username].overdueTasksCount += 1;
              }
            });
          }
        }

        if (isDone) {
          let completionDate = task.updatedAt || new Date();
          const statusDoneActivity = task.activity
            ?.filter(act => act.type === 'status_change' || act.changes?.some(c => c.field === 'status' && c.to === 'Done'))
            ?.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          
          if (statusDoneActivity) {
            completionDate = new Date(statusDoneActivity.createdAt);
          }

          assigneesUsernames.forEach(username => {
            if (stats[username]) {
              stats[username].completedTasksList.push({
                taskId: task._id.toString(),
                priority: task.priority || 'Medium',
                storyPoints: task.storyPoints || 0,
                type: task.type || 'Feature',
                dueDate: task.dueDate ? new Date(task.dueDate) : null,
                completionDate,
                reporter: task.reporter ? userMap.get(task.reporter.toString()) : null
              });
            }
          });
        }
      });

      const leaderboardList = [];
      let maxPoints = 0;
      let starPerformerCandidate = null;

      Object.values(stats).forEach(userStats => {
        userStats.commentsList.sort((a, b) => a.createdAt - b.createdAt);
        let lastCommentTime = null;
        const taskCommentCounts = {};

        userStats.commentsList.forEach(comment => {
          if (comment.text.length < 10) return;
          if (lastCommentTime && (comment.createdAt - lastCommentTime) < 5 * 60 * 1000) return;
          const tId = comment.taskId;
          taskCommentCounts[tId] = (taskCommentCounts[tId] || 0) + 1;
          if (taskCommentCounts[tId] > 3) return;

          const isSelfAssigned = comment.taskAssignees.includes(userStats.username);
          userStats.points += isSelfAssigned ? 1 : 2;
          userStats.commentsCount += 1;
          lastCommentTime = comment.createdAt;
        });

        userStats.completedTasksList.sort((a, b) => a.completionDate - b.completionDate);
        let comboCount = 0;
        let prevCompletionTime = null;

        userStats.completedTasksList.forEach(ct => {
          let basePoints = 10;
          if (ct.priority === 'Urgent') basePoints = 20;
          else if (ct.priority === 'High') basePoints = 15;
          else if (ct.priority === 'Low') basePoints = 5;

          const complexityPoints = (ct.storyPoints || 0) * 2;
          const bugBonus = ct.type === 'Bug' ? 2 : 0;

          let earlyBonus = 0;
          if (ct.dueDate) {
            userStats.totalTasksWithDueDate += 1;
            if (ct.completionDate <= ct.dueDate) {
              userStats.tasksCompletedOnTime += 1;
              const diffMs = ct.dueDate - ct.completionDate;
              if (diffMs >= 24 * 60 * 60 * 1000) {
                earlyBonus = 10;
                userStats.tasksCompletedEarly += 1;
              }
            }
          }

          let taskPoints = basePoints + complexityPoints + bugBonus + earlyBonus;
          userStats.points += taskPoints;
          userStats.tasksCompleted += 1;
          userStats.storyPointsCompleted += (ct.storyPoints || 0);

          if (ct.type === 'Bug') {
            userStats.bugTasksCompleted += 1;
          }

          if (prevCompletionTime) {
            const diffMs = ct.completionDate - prevCompletionTime;
            if (diffMs <= 24 * 60 * 60 * 1000) {
              comboCount += 1;
              let comboBonus = comboCount === 1 ? 1 : comboCount === 2 ? 3 : comboCount === 3 ? 4 : 5;
              userStats.points += comboBonus;
            } else {
              comboCount = 0;
            }
          }
          prevCompletionTime = ct.completionDate;
        });

        const onTimeRate = userStats.totalTasksWithDueDate > 0 ? (userStats.tasksCompletedOnTime / userStats.totalTasksWithDueDate) : 1.0;
        if (userStats.totalTasksWithDueDate >= 5 && onTimeRate >= 0.90) {
          userStats.points += 15;
        }

        userStats.points -= (userStats.reopenedTasksCount * 4);
        userStats.points -= (userStats.overdueTasksCount * 5);
        if (userStats.points < 0) userStats.points = 0;

        if (userStats.tasksCompletedEarly >= 3) {
          userStats.badges.push({ name: 'Early Bird', icon: '🚀' });
        }
        if (userStats.tasksCompleted >= 10) {
          userStats.badges.push({ name: 'Task Crusher', icon: '🏆' });
        }
        if (userStats.storyPointsCompleted >= 30) {
          userStats.badges.push({ name: 'Velocity Master', icon: '⚡' });
        }
        if (userStats.commentsCount >= 15) {
          userStats.badges.push({ name: 'Conversation Starter', icon: '💬' });
        }
        if (userStats.bugTasksCompleted >= 5) {
          userStats.badges.push({ name: 'Bug Buster', icon: '🛠️' });
        }
        if (userStats.totalTasksWithDueDate >= 5 && userStats.tasksCompletedOnTime === userStats.totalTasksWithDueDate) {
          userStats.badges.push({ name: 'Perfectionist', icon: '🎯' });
        }

        if (userStats.points > maxPoints) {
          maxPoints = userStats.points;
          starPerformerCandidate = userStats.username;
        }

        leaderboardList.push(userStats);
      });

      if (starPerformerCandidate && maxPoints >= 15) {
        const topUser = leaderboardList.find(u => u.username === starPerformerCandidate);
        if (topUser) {
          topUser.badges.push({ name: 'Star Performer', icon: '🌟' });
        }
      }

      grantedBadges.forEach(grant => {
        const targetUser = grant.username;
        const badge = customBadges.find(cb => cb._id.toString() === grant.badgeId.toString());
        if (stats[targetUser] && badge) {
          stats[targetUser].badges.push({
            name: badge.name,
            icon: badge.icon || '🎖️'
          });
        }
      });

      leaderboardList.sort((a, b) => b.points - a.points);
      leaderboardList.forEach((item, index) => {
        item.rank = index + 1;
      });

      return JSON.stringify(leaderboardList.map(item => ({
        rank: item.rank,
        username: item.username,
        name: item.name,
        points: item.points,
        tasksCompleted: item.tasksCompleted,
        storyPointsCompleted: item.storyPointsCompleted,
        commentsCount: item.commentsCount,
        badges: item.badges.map(b => `${b.icon} ${b.name}`)
      })).slice(0, 15));
    }

    if (name === 'delete_meetings') {
      if (userRole === 'Intern') {
        return JSON.stringify({ error: "Permission Denied: Interns are not authorized to cancel/delete meetings." });
      }

      const { meetingIds } = args;
      if (!meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0) {
        return JSON.stringify({ error: "Invalid or missing meetingIds array" });
      }

      const deletedList = [];
      const failedList = [];

      for (const id of meetingIds) {
        if (!id) {
          failedList.push({ id, error: "Invalid meeting ID format" });
          continue;
        }

        const queryIds = [id];
        if (ObjectId.isValid(id)) queryIds.push(new ObjectId(id));

        const meeting = await db.collection('events').findOne({ _id: { $in: queryIds } });
        if (!meeting) {
          failedList.push({ id, error: "Meeting not found" });
          continue;
        }

        const isHost = (meeting.host || '').toLowerCase() === userEmail.toLowerCase();
        if (!isHost) {
          failedList.push({ id, title: meeting.title, error: "Forbidden: Only the host can cancel/delete this meeting" });
          continue;
        }

        await db.collection('events').deleteOne({ _id: { $in: queryIds } });
        deletedList.push({ id, title: meeting.title });
      }

      return JSON.stringify({
        success: deletedList.length > 0,
        deleted: deletedList,
        failed: failedList,
        auditLog: `Upcheck Admin Bot has deleted ${deletedList.length} meeting(s) on behalf of ${userName} (${userEmail}).`
      });
    }

    if (name === 'update_meeting') {
      if (userRole === 'Intern') {
        return JSON.stringify({ error: "Permission Denied: Interns are not authorized to update meetings." });
      }

      const { meetingId, title, description, startTime, duration, joinUrl, provider, participants, status } = args;

      if (!meetingId) {
        return JSON.stringify({ error: "Invalid or missing meetingId" });
      }
      const queryIds = [meetingId];
      if (ObjectId.isValid(meetingId)) queryIds.push(new ObjectId(meetingId));

      const meeting = await db.collection('events').findOne({ _id: { $in: queryIds } });
      if (!meeting) {
        return JSON.stringify({ error: "Meeting not found" });
      }

      const isHost = (meeting.host || '').toLowerCase() === userEmail.toLowerCase();
      if (!isHost) {
        return JSON.stringify({ error: "Forbidden: Only the host can update/modify this meeting." });
      }

      const updateDoc = { updatedAt: new Date() };

      if (title !== undefined) updateDoc.title = title.trim();
      if (description !== undefined) updateDoc.description = description ? description.trim() : '';
      if (startTime !== undefined) updateDoc.startTime = startTime;
      if (duration !== undefined) updateDoc.duration = Number(duration);
      if (joinUrl !== undefined) updateDoc.joinUrl = joinUrl ? joinUrl.trim() : '';
      if (provider !== undefined) updateDoc.provider = provider;
      if (participants !== undefined) updateDoc.participants = participants;
      if (status !== undefined) updateDoc.status = status;

      const isTimeChanged = startTime && meeting.startTime && new Date(startTime).getTime() !== new Date(meeting.startTime).getTime();

      const result = await db.collection('events').findOneAndUpdate(
        { _id: { $in: queryIds } },
        { $set: updateDoc },
        { returnDocument: 'after' }
      );

      // Trigger notifications if timing changed (rescheduled/postponed)
      if (isTimeChanged) {
        ;(async () => {
          try {
            const allParticipants = participants || meeting.participants || [];
            const updatedTitle = title || meeting.title;
            const updatedJoinUrl = joinUrl || meeting.joinUrl || meeting.zoomMeetingUrl;
            const updatedProvider = provider || meeting.provider;

            const oldDate = new Date(meeting.startTime);
            const newDate = new Date(startTime);

            const oldDateStr = oldDate.toLocaleString('en-IN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              timeZone: 'Asia/Kolkata',
            });

            const newDateStr = newDate.toLocaleString('en-IN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              timeZone: 'Asia/Kolkata',
            });

            // Send push notifications
            for (const participantEmail of allParticipants) {
              try {
                const participantUser = await db.collection('admin_users').findOne(
                  { email: { $regex: `^${participantEmail}$`, $options: 'i' } },
                  { projection: { _id: 1 } }
                );
                if (participantUser) {
                  await sendPushNotification(
                    participantUser._id.toString(),
                    '📅 Meeting Postponed',
                    `"${updatedTitle}" rescheduled to ${newDateStr} (was ${oldDateStr})`,
                    { type: 'meeting_postponed', meetingId: meetingId }
                  ).catch(() => {});

                  // Insert matching record into admin_notifications for the app screen
                  await db.collection('admin_notifications').insertOne({
                    id: `meet_postponed_${meetingId}_${participantUser._id.toString()}_${Date.now()}`,
                    type: 'meeting_postponed',
                    severity: 'medium',
                    timestamp: new Date().toISOString(),
                    acknowledged: false,
                    acknowledgedAt: null,
                    acknowledgedBy: null,
                    targetUser: participantEmail.toLowerCase(),
                    data: {
                      title: '📅 Meeting Postponed',
                      message: `Meeting "${updatedTitle}" has been rescheduled to ${newDateStr} (was ${oldDateStr}).`,
                      meetingId: meetingId
                    },
                    createdAt: new Date()
                  }).catch(() => {});
                }
              } catch (perUserErr) {
                console.error(`Push notify fail for ${participantEmail}:`, perUserErr.message);
              }
            }

            // Send emails
            for (const participantEmail of allParticipants) {
              try {
                const subject = `📅 Rescheduled: ${updatedTitle}`;
                const emailOptions = {
                  host: meeting.host,
                  participants: allParticipants,
                  event: {
                    title: updatedTitle,
                    description: `This meeting timing has been updated.\n\n* **Old Time**: ${oldDateStr}\n* **New Time**: ${newDateStr}\n\n${description || meeting.description || ''}`,
                    startTime: startTime,
                    duration: duration || meeting.duration || 30,
                    provider: updatedProvider,
                    joinUrl: updatedJoinUrl
                  }
                };
                await sendEmail(participantEmail, subject, emailOptions).catch(() => {});
              } catch (perUserErr) {
                console.error(`Email send fail for ${participantEmail}:`, perUserErr.message);
              }
            }
          } catch (notifErr) {
            console.error('[botAgent update_meeting] Notifications failed:', notifErr.message);
          }
        })();
      }

      return JSON.stringify({
        success: true,
        meeting: result,
        isTimeChanged,
        auditLog: `Upcheck Admin Bot has updated meeting "${result.title}" on behalf of ${userName} (${userEmail}).`
      });
    }

    if (name === 'send_email_broadcast') {
      if (userRole !== 'Admin' && userRole !== 'Console admin') {
        return JSON.stringify({ error: `Permission Denied: Users with role '${userRole}' are not authorized to send email broadcasts.` });
      }

      const { recipients, subject, body } = args;
      if (!subject || !subject.trim()) {
        return JSON.stringify({ error: "Subject is required." });
      }
      if (!body || !body.trim()) {
        return JSON.stringify({ error: "Body is required." });
      }

      let emailList = [];

      if (recipients) {
        if (recipients.emails && Array.isArray(recipients.emails)) {
          emailList = emailList.concat(recipients.emails.filter(Boolean));
        }

        if (recipients.usernames && Array.isArray(recipients.usernames)) {
          const userDocs = await db.collection('admin_users').find({
            username: { $in: recipients.usernames.map(u => u.trim()) }
          }).toArray();
          const userEmails = userDocs.map(u => u.email).filter(Boolean);
          emailList = emailList.concat(userEmails);
        }

        if (recipients.teamNames && Array.isArray(recipients.teamNames)) {
          const teamDocs = await db.collection('teams').find({
            name: { $in: recipients.teamNames.map(t => new RegExp(`^${t.trim()}$`, 'i')) }
          }).toArray();

          const allMemberIds = [];
          for (const team of teamDocs) {
            if (team.lead) allMemberIds.push(team.lead);
            if (team.members && Array.isArray(team.members)) {
              allMemberIds.push(...team.members);
            }
          }

          if (allMemberIds.length > 0) {
            const memberDocs = await db.collection('admin_users').find({
              _id: { $in: allMemberIds.map(id => {
                try { return new ObjectId(id); } catch { return id; }
              }) }
            }).toArray();
            const teamEmails = memberDocs.map(u => u.email).filter(Boolean);
            emailList = emailList.concat(teamEmails);
          }
        }
      }

      const uniqueEmails = Array.from(new Set(emailList.map(e => e.trim().toLowerCase())));

      if (uniqueEmails.length === 0) {
        return JSON.stringify({ error: "No valid recipient email addresses found. Please specify valid emails, usernames, or teamNames." });
      }

      const { sendEmail: sendUnifiedEmail } = await import('./emailService.js');
      const results = [];
      
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background-color: #0f172a; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 20px;">Organization Broadcast</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">Sent by ${userName} via Upcheck Admin Bot</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6; font-size: 15px;">
            <h3 style="color: #0f172a; margin-top: 0; margin-bottom: 16px; font-size: 18px;">${subject}</h3>
            <div style="white-space: pre-wrap;">${body}</div>
          </div>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
            This email was sent to you by the organization administrator via Upcheck Technologies.
          </div>
        </div>
      `;

      for (const recipientEmail of uniqueEmails) {
        try {
          await sendUnifiedEmail({
            to: recipientEmail,
            subject: subject,
            html: htmlBody,
            text: `${subject}\n\nSent by ${userName} via Upcheck Admin Bot\n\n${body}`,
            type: 'broadcast'
          });
          results.push({ email: recipientEmail, status: 'sent' });
        } catch (err) {
          results.push({ email: recipientEmail, status: 'failed', error: err.message });
        }
      }

      const successCount = results.filter(r => r.status === 'sent').length;
      return JSON.stringify({
        success: true,
        message: `Successfully sent broadcast to ${successCount} out of ${uniqueEmails.length} recipients.`,
        sentCount: successCount,
        recipients: results
      });
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (err) {
    console.error(`Execute tool error [${name}]:`, err);
    return JSON.stringify({ error: `Failed to execute action: ${err.message}` });
  }
}

function ultraSummarize(content) {
  if (!content) return '';
  let cleanContent = content.replace(/\|[\s\S]*?\|/g, '');

  // 1. Extract parameters using flexible matchers
  const titleMatch = cleanContent.match(/(?:Title|Project|Meeting)\**:\s*\**([^\n*`]+)/i);
  const dateMatch = cleanContent.match(/(?:Date & Time|Date|Time)\**:\s*\**([^\n*`]+)/i);
  const hostMatch = cleanContent.match(/Host\**:\s*\**([^\n*`]+)/i);
  const providerMatch = cleanContent.match(/Provider\**:\s*\**([^\n*`]+)/i);
  const annContentMatch = cleanContent.match(/(?:Content|Announcement)\**:\s*\**([^\n*`]+)/i);
  const importanceMatch = cleanContent.match(/(?:Important|Push|Broadcast)\**:\s*\**([^\n*`]+)/i);
  const taskMatch = cleanContent.match(/(?:Task|sprint|assignee|status|priority)\**:\s*\**([^\n*`]+)/i);

  // 2. Extract entities format-independently (bulletproof)
  const emails = cleanContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const uniqueEmails = Array.from(new Set(emails));

  const urls = cleanContent.match(/(https?:\/\/[^\s`"]+|meet\.google\.com\/[a-z0-9-]+|zoom\.us\/j\/[0-9]+)/gi) || [];
  const uniqueUrls = Array.from(new Set(urls));

  const parts = [];
  if (titleMatch) parts.push(`Title: "${titleMatch[1].trim()}"`);
  if (dateMatch) parts.push(`Time: "${dateMatch[1].trim()}"`);
  if (hostMatch) parts.push(`Host: "${hostMatch[1].trim()}"`);
  if (providerMatch) parts.push(`Provider: "${providerMatch[1].trim()}"`);
  if (annContentMatch) parts.push(`Content: "${annContentMatch[1].trim().substring(0, 80)}"`);
  if (importanceMatch) parts.push(`Broadcast: "${importanceMatch[1].trim()}"`);
  if (taskMatch) parts.push(`Query: "${taskMatch[0].trim()}"`);

  if (uniqueUrls.length > 0) parts.push(`Link: "${uniqueUrls[0]}"`);
  if (uniqueEmails.length > 0) parts.push(`Participants: "${uniqueEmails.join(', ')}"`);

  if (parts.length > 0) {
    return `[Context: ${parts.join(', ')}]`;
  }
  
  // 3. Conversational filler and stop-phrase stripper for general text
  let compressed = cleanContent
    .replace(/(?:sure|ok|okay|yes|no|hello|hi|hey|please|thanks|thank you|sorry|apologies|here is|here's|would you like|just reply with|let me know|to set it up|i'll need|brief overview|short name|duration of|who you want|email addresses|Google Meet or Zoom|starts with|ends at|ends with|i can help you|following details)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return compressed.length > 120 ? compressed.substring(0, 120).trim() + '... (ultra-summarized)' : compressed;
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
- **CRITICAL**: When the user asks to create/schedule a meeting (\`create_meeting\`), delete/cancel meetings (\`delete_meetings\`), publish, edit, or delete an announcement (\`create_announcement\`, \`edit_announcement\`, \`delete_announcement\`), or send an email broadcast (\`send_email_broadcast\`), you **MUST NOT** call the tool immediately.
- First, present a clear preview of the proposed changes/details and ask the user to explicitly confirm.
- For meetings: ask "Would you like me to schedule this meeting? Do you want to send email invites to the participants?" and prompt them to provide the join link.
- For cancelling meetings: ask "Would you like me to delete/cancel these meetings? (list their titles)" and confirm.
- For announcements: ask "Would you like me to publish/edit/delete this announcement? Do you want to broadcast a push notification to all users?" Only set \`isImportant: true\` if they explicitly agree to send a push broadcast.
- For email broadcasts: resolve recipients, present a preview of the subject, body, and the list of matching recipient email addresses, and ask "Would you like me to send this email broadcast to the listed recipients?"
- Only invoke the write tool once the user explicitly confirms (e.g., "Confirm", "Yes", "Go ahead").

## Tool Usage Guidelines
- **Read-only tools** (\`list_meetings\`, \`list_users\`, \`list_teams\`, \`list_projects\`, \`list_announcements\`, \`get_workspace_workload\`): Call these freely to find requested information.
- For \`list_meetings\`: call this tool whenever the user asks about meetings. You **MUST NOT** hallucinate or make up meetings that are not returned by the tool. If the tool returns no meetings, inform the user that there are no meetings scheduled.
- If you need to search or find past meetings, you must explicitly pass \`includePast: true\` to \`list_meetings\`.
- For \`list_meetings\`, you can filter by \`teamName\` (e.g., 'Dairy app') to find meetings attended by a team's members. Always check this first if the user queries a team's meetings.
- When querying user workload, project counts, or active tasks per user, call \`get_workspace_workload\` to get a single unified summary of all users.
- When a tool returns an error, explain it clearly and suggest next steps.

## Permission Rules
- Intern: ❌ Denied create_meeting, delete_meetings, list_teams, create_announcement, edit_announcement, delete_announcement, send_email_broadcast
- Member: ✅ Allowed create_meeting, delete_meetings | ❌ Denied list_teams, create_announcement, edit_announcement, delete_announcement, send_email_broadcast
- Admin / Console admin: ✅ Allowed all`
      }
    ];

    if (chatType === 'dm') {
      const history = await db.collection('chat_messages')
        .find({ conversationId: chatId, status: { $ne: 'streaming' } })
        .sort({ createdAt: -1 })
        .limit(4)
        .toArray();
      
      const totalLen = history.reduce((sum, m) => sum + (m.body || '').length, 0);
      const shouldUltraSummarize = currentUser.ultraSummarizeMode && totalLen > 350;

      history.reverse().forEach((m, idx) => {
        let content = m.body || '';
        if (shouldUltraSummarize && idx < history.length - 1) {
          content = ultraSummarize(content);
        } else if (idx < history.length - 1 && content.length > 150) {
          content = content.replace(/\|[\s\S]*?\|/g, '[Table omitted]').substring(0, 150) + '... (truncated)';
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
        .limit(4)
        .toArray();
      
      const totalLen = history.reduce((sum, m) => sum + (m.body || '').length, 0);
      const shouldUltraSummarize = currentUser.ultraSummarizeMode && totalLen > 350;

      history.reverse().forEach((m, idx) => {
        let content = m.body || '';
        if (shouldUltraSummarize && idx < history.length - 1) {
          content = ultraSummarize(content);
        } else if (idx < history.length - 1 && content.length > 150) {
          content = content.replace(/\|[\s\S]*?\|/g, '[Table omitted]').substring(0, 150) + '... (truncated)';
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
        .limit(4)
        .toArray();
      
      const totalLen = history.reduce((sum, m) => sum + (m.body || '').length, 0);
      const shouldUltraSummarize = currentUser.ultraSummarizeMode && totalLen > 350;

      history.reverse().forEach((m, idx) => {
        let content = m.body || '';
        if (shouldUltraSummarize && idx < history.length - 1) {
          content = ultraSummarize(content);
        } else if (idx < history.length - 1 && content.length > 150) {
          content = content.replace(/\|[\s\S]*?\|/g, '[Table omitted]').substring(0, 150) + '... (truncated)';
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
      const modelName = currentUser.useLesserIntelligence 
        ? 'meta-llama/llama-4-scout-17b-16e-instruct' 
        : 'openai/gpt-oss-120b';

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${decryptedKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
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
