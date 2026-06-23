import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { canAccessProject } from '../../../../../lib/projectPermissions';

export const dynamic = 'force-dynamic';

// Helper to check if user is a project manager or superManager
function isProjectManager(user, project) {
  if (user.role === 'Super Manager') return true;
  if (project.superManager === user.username) return true;
  return project.members?.some(m => m.user === user.username && m.role === 'Project Manager') || false;
}

export async function GET(req, { params }) {
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

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify access
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
          { members: user._id },
          { lead: user._id }
        ]
      })
      .toArray();

    if (!canAccessProject(user, project, userTeams)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch all tasks, custom badge definitions, and badge grants
    const tasks = await db.collection('project_tasks').find({ projectId: new ObjectId(id) }).toArray();
    const customBadges = await db.collection('project_custom_badges').find({ projectId: new ObjectId(id) }).toArray();
    const grantedBadges = await db.collection('project_member_badges').find({ projectId: new ObjectId(id) }).toArray();

    // 2. Build list of potential members
    const membersSet = new Set();
    if (project.superManager) membersSet.add(project.superManager);
    project.members?.forEach(m => {
      if (m.user) membersSet.add(m.user);
    });

    // Also include anyone who was assigned to tasks or did something
    tasks.forEach(t => {
      t.comments?.forEach(c => {
        const commenter = c.userName || c.authorName;
        if (commenter) membersSet.add(commenter);
      });
      t.activity?.forEach(act => {
        if (act.userName) membersSet.add(act.userName);
      });
    });

    // Resolve assignees IDs to usernames
    const allUserIds = new Set();
    tasks.forEach(t => {
      t.assignees?.forEach(uid => allUserIds.add(new ObjectId(uid)));
      if (t.reporter) allUserIds.add(new ObjectId(t.reporter));
    });

    const resolvedUsers = await db.collection('admin_users')
      .find({ _id: { $in: Array.from(allUserIds) } }, { projection: { username: 1 } })
      .toArray();
    
    const userMap = new Map(resolvedUsers.map(u => [u._id.toString(), u.username]));
    resolvedUsers.forEach(u => {
      if (u.username) membersSet.add(u.username);
    });

    // Initialize stats map
    const stats = {};
    membersSet.forEach(username => {
      stats[username] = {
        username,
        tasksCompleted: 0,
        storyPointsCompleted: 0,
        tasksCompletedOnTime: 0,
        tasksCompletedEarly: 0,
        totalTasksWithDueDate: 0,
        commentsCount: 0,
        activityCount: 0,
        bugTasksCompleted: 0,
        points: 0,
        badges: [],
        reopenedTasksCount: 0,
        overdueTasksCount: 0,
        completedTasksList: [],
        commentsList: []
      };
    });

    // 3. Compute stats from Tasks
    tasks.forEach(task => {
      const isDone = task.status === 'Done';
      const assigneesUsernames = task.assignees?.map(uid => userMap.get(uid.toString())).filter(Boolean) || [];

      // Collect comments
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

      // Track reopened task activities
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

      // Track overdue task counts
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
        // Find completion date from activity log
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

    // 4. Calculate points and compile automatic badges
    const leaderboardList = [];
    let maxPoints = 0;
    let starPerformerCandidate = null;
    const isManagerUser = isProjectManager(user, project);

    Object.values(stats).forEach(userStats => {
      // 4.1 Comment Points with Cooldown (5 mins) and max 3 comments (+6 points) per task
      userStats.commentsList.sort((a, b) => a.createdAt - b.createdAt);
      let lastCommentTime = null;
      const taskCommentCounts = {};

      userStats.commentsList.forEach(comment => {
        if (comment.text.length < 10) return; // Must be >= 10 chars
        
        // Enforce 5-minute global cooldown between points-earning comments
        if (lastCommentTime && (comment.createdAt - lastCommentTime) < 5 * 60 * 1000) {
          return;
        }

        // Enforce max 3 comments per task
        const tId = comment.taskId;
        taskCommentCounts[tId] = (taskCommentCounts[tId] || 0) + 1;
        if (taskCommentCounts[tId] > 3) {
          return;
        }

        // Collaboration incentive: +2 if someone else's task, +1 if self-assigned
        const isSelfAssigned = comment.taskAssignees.includes(userStats.username);
        const pts = isSelfAssigned ? 1 : 2;

        userStats.points += pts;
        userStats.commentsCount += 1;
        lastCommentTime = comment.createdAt;
      });

      // 4.2 Completed Tasks Points & Combo Calculation
      userStats.completedTasksList.sort((a, b) => a.completionDate - b.completionDate);
      
      let comboCount = 0;
      let prevCompletionTime = null;

      userStats.completedTasksList.forEach(ct => {
        // Base completion points by priority
        let basePoints = 10; // Medium
        if (ct.priority === 'Urgent') basePoints = 20;
        else if (ct.priority === 'High') basePoints = 15;
        else if (ct.priority === 'Low') basePoints = 5;

        // Complexity: storyPoints * 2
        const complexityPoints = (ct.storyPoints || 0) * 2;

        // Bug Fix bonus
        const bugBonus = ct.type === 'Bug' ? 2 : 0;

        // Early completion bonus
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

        // Self-assignment halving: non-managers get halved
        const isSelf = ct.reporter === userStats.username;
        if (isSelf && !isManagerUser) {
          taskPoints = Math.round(taskPoints / 2);
        }

        userStats.points += taskPoints;
        userStats.tasksCompleted += 1;
        userStats.storyPointsCompleted += (ct.storyPoints || 0);

        if (ct.type === 'Bug') {
          userStats.bugTasksCompleted += 1;
        }

        // Combo calculations (completions within 24 hours of each other)
        if (prevCompletionTime) {
          const diffMs = ct.completionDate - prevCompletionTime;
          if (diffMs <= 24 * 60 * 60 * 1000) {
            comboCount += 1;
            let comboBonus = 0;
            if (comboCount === 1) comboBonus = 1;
            else if (comboCount === 2) comboBonus = 3;
            else if (comboCount === 3) comboBonus = 4;
            else if (comboCount >= 4) comboBonus = 5;

            userStats.points += comboBonus;
          } else {
            comboCount = 0;
          }
        }
        prevCompletionTime = ct.completionDate;
      });

      // 4.3 High On-Time Rate Bonus
      const onTimeRate = userStats.totalTasksWithDueDate > 0 
        ? (userStats.tasksCompletedOnTime / userStats.totalTasksWithDueDate)
        : 1.0;
      if (userStats.totalTasksWithDueDate >= 5 && onTimeRate >= 0.90) {
        userStats.points += 15;
      }

      // 4.4 Overdue and Reopened penalties
      userStats.points -= (userStats.reopenedTasksCount * 4);
      userStats.points -= (userStats.overdueTasksCount * 5);

      // Floor points at 0 (contributions shouldn't be negative)
      if (userStats.points < 0) {
        userStats.points = 0;
      }

      // 4.5 Unlocking automatic badges
      // 🚀 Early Bird (Completed 3+ tasks early)
      if (userStats.tasksCompletedEarly >= 3) {
        userStats.badges.push({
          name: 'Early Bird',
          description: 'Completed 3+ tasks at least 24 hours before they were due.',
          icon: '🚀',
          color: '#3b82f6',
          type: 'automatic'
        });
      }

      // 🏆 Task Crusher (Completed 10+ tasks)
      if (userStats.tasksCompleted >= 10) {
        userStats.badges.push({
          name: 'Task Crusher',
          description: 'Completed 10+ tasks in this project.',
          icon: '🏆',
          color: '#f59e0b',
          type: 'automatic'
        });
      }

      // ⚡ Velocity Master (Completed 30+ story points)
      if (userStats.storyPointsCompleted >= 30) {
        userStats.badges.push({
          name: 'Velocity Master',
          description: 'Completed 30+ story points.',
          icon: '⚡',
          color: '#ef4444',
          type: 'automatic'
        });
      }

      // 💬 Conversation Starter (Wrote 15+ comments)
      if (userStats.commentsCount >= 15) {
        userStats.badges.push({
          name: 'Conversation Starter',
          description: 'Wrote 15+ comments on tasks.',
          icon: '💬',
          color: '#10b981',
          type: 'automatic'
        });
      }

      // 🛠️ Bug Buster (Completed 5+ Bug tasks)
      if (userStats.bugTasksCompleted >= 5) {
        userStats.badges.push({
          name: 'Bug Buster',
          description: 'Completed 5+ tasks of type Bug.',
          icon: '🛠️',
          color: '#8b5cf6',
          type: 'automatic'
        });
      }

      // 🎯 Perfectionist (5+ tasks with due dates, 100% on-time completion)
      if (userStats.totalTasksWithDueDate >= 5 && userStats.tasksCompletedOnTime === userStats.totalTasksWithDueDate) {
        userStats.badges.push({
          name: 'Perfectionist',
          description: 'Completed 5+ tasks on time with a 100% success rate.',
          icon: '🎯',
          color: '#ec4899',
          type: 'automatic'
        });
      }

      // Track Star Performer candidate
      if (userStats.points > maxPoints) {
        maxPoints = userStats.points;
        starPerformerCandidate = userStats.username;
      }

      leaderboardList.push(userStats);
    });

    // 🌟 Star Performer (Highest points, minimum 15 points)
    if (starPerformerCandidate && maxPoints >= 15) {
      const topUser = leaderboardList.find(u => u.username === starPerformerCandidate);
      if (topUser) {
        topUser.badges.push({
          name: 'Star Performer',
          description: 'Currently has the highest total contribution points on the leaderboard.',
          icon: '🌟',
          color: '#eab308',
          type: 'automatic'
        });
      }
    }

    // 5. Apply custom/manual badges
    grantedBadges.forEach(grant => {
      const targetUser = grant.username;
      const badge = customBadges.find(cb => cb._id.toString() === grant.badgeId.toString());
      if (stats[targetUser] && badge) {
        stats[targetUser].badges.push({
          id: badge._id.toString(),
          name: badge.name,
          description: badge.description,
          icon: badge.icon || '🎖️',
          color: badge.color || '#6b7280',
          type: 'custom',
          grantedBy: grant.grantedBy,
          grantedAt: grant.grantedAt
        });
      }
    });

    // Sort leaderboard by points descending
    leaderboardList.sort((a, b) => b.points - a.points);

    // Add rank
    leaderboardList.forEach((item, index) => {
      item.rank = index + 1;
    });

    return NextResponse.json({
      leaderboard: leaderboardList.map(item => ({
        ...item,
        // Cleanup lists to reduce response size
        completedTasksList: undefined,
        commentsList: undefined
      })),
      customBadges: customBadges.map(cb => ({
        id: cb._id.toString(),
        name: cb.name,
        description: cb.description,
        icon: cb.icon,
        color: cb.color
      })),
      isManager: isProjectManager(user, project)
    });

  } catch (error) {
    console.error('Failed to fetch leaderboard data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST - Create a new custom badge definition
export async function POST(req, { params }) {
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

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check manager status
    if (!isProjectManager(user, project)) {
      return NextResponse.json({ error: 'Forbidden: Only managers can manage custom badges' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, icon, color } = body;

    if (!name || !description) {
      return NextResponse.json({ error: 'Badge name and description are required' }, { status: 400 });
    }

    const newBadge = {
      projectId: new ObjectId(id),
      name,
      description,
      icon: icon || '🎖️',
      color: color || '#6b7280',
      createdAt: new Date(),
      createdBy: user.username
    };

    const result = await db.collection('project_custom_badges').insertOne(newBadge);

    return NextResponse.json({
      success: true,
      badge: {
        id: result.insertedId.toString(),
        ...newBadge,
        projectId: id
      }
    });

  } catch (error) {
    console.error('Failed to create custom badge:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT - Edit a custom badge definition
export async function PUT(req, { params }) {
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

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check manager status
    if (!isProjectManager(user, project)) {
      return NextResponse.json({ error: 'Forbidden: Only managers can edit custom badges' }, { status: 403 });
    }

    const body = await req.json();
    const { badgeId, name, description, icon, color } = body;

    if (!badgeId || !name || !description) {
      return NextResponse.json({ error: 'Badge ID, name, and description are required' }, { status: 400 });
    }

    await db.collection('project_custom_badges').updateOne(
      { _id: new ObjectId(badgeId), projectId: new ObjectId(id) },
      { $set: { name, description, icon: icon || '🎖️', color: color || '#6b7280', updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to update custom badge:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE - Delete a custom badge definition completely (and revoke from all users)
export async function DELETE(req, { params }) {
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

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check manager status
    if (!isProjectManager(user, project)) {
      return NextResponse.json({ error: 'Forbidden: Only managers can delete custom badges' }, { status: 403 });
    }

    const body = await req.json();
    const { badgeId } = body;

    if (!badgeId) {
      return NextResponse.json({ error: 'Badge ID is required' }, { status: 400 });
    }

    // Delete badge definition
    await db.collection('project_custom_badges').deleteOne({
      _id: new ObjectId(badgeId),
      projectId: new ObjectId(id)
    });

    // Revoke from all members
    await db.collection('project_member_badges').deleteMany({
      badgeId: new ObjectId(badgeId),
      projectId: new ObjectId(id)
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to delete custom badge:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
