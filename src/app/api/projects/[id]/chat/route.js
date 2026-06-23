import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserPermissionLevel } from '../../../../../lib/projectPermissions';
import { sendEmail } from '../../../../../lib/emailService';

function isProjectManager(user, project) {
  if (user.role === 'Super Manager') return true;
  if (project.superManager === user.username) return true;
  return project.members?.some(m => m.user === user.username && m.role === 'Project Manager') || false;
}

// GET - Retrieve messages and pinned messages
export async function GET(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Validate project permissions
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
          { members: user._id },
          { lead: user._id },
        ],
      })
      .toArray();

    const perms = getUserPermissionLevel(user, project, userTeams);
    if (!perms) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Update user's last read status for this project
    await db.collection('project_chat_read_status').updateOne(
      { userId: userIdStr, projectId: new ObjectId(id) },
      { $set: { lastReadAt: new Date() } },
      { upsert: true }
    );

    // Fetch messages (excluding messages deleted for this user)
    const messages = await db.collection('project_messages')
      .find({
        projectId: new ObjectId(id),
        deletedFor: { $ne: userIdStr }
      })
      .sort({ createdAt: 1 })
      .toArray();

    // Map messages
    const mappedMessages = messages.map(m => ({
      id: m._id.toString(),
      body: m.body,
      createdAt: m.createdAt,
      sender: m.sender,
      pinned: m.pinned === true,
      pinnedAt: m.pinnedAt,
      pinnedBy: m.pinnedBy,
      isDeletedForEveryone: m.isDeletedForEveryone === true
    }));

    return NextResponse.json({
      messages: mappedMessages,
      isManager: isProjectManager(user, project)
    });

  } catch (error) {
    console.error('Failed to fetch project chat:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST - Send a project message (includes mention parsing & email notifications)
export async function POST(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Validate project permissions
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
          { members: user._id },
          { lead: user._id },
        ],
      })
      .toArray();

    const perms = getUserPermissionLevel(user, project, userTeams);
    if (!perms) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { messageText, clientId } = body;

    if (!messageText || !messageText.trim()) {
      return NextResponse.json({ error: 'Message body cannot be empty' }, { status: 400 });
    }

    // Check for duplicate (by clientId)
    if (clientId) {
      const existing = await db.collection('project_messages').findOne({ clientId });
      if (existing) {
        return NextResponse.json({
          success: true,
          message: {
            id: existing._id.toString(),
            body: existing.body,
            createdAt: existing.createdAt,
            sender: existing.sender,
            pinned: existing.pinned === true
          }
        });
      }
    }

    // Parse @notify mentions
    // Format: @notify username
    const notifyRegex = /@notify\s+([a-zA-Z0-9_.-]+)/g;
    let match;
    const notifyUsernames = [];
    while ((match = notifyRegex.exec(messageText)) !== null) {
      const targetUsername = match[1];
      if (targetUsername && targetUsername !== user.username) {
        notifyUsernames.push(targetUsername);
      }
    }

    const spamWarnings = [];

    // Process @notify mentions
    if (notifyUsernames.length > 0) {
      for (const targetUser of notifyUsernames) {
        const recipient = await db.collection('admin_users').findOne({ username: targetUser });
        if (!recipient) {
          spamWarnings.push(`User @${targetUser} does not exist.`);
          continue;
        }

        // Verify recipient is a project member
        const isMember = project.superManager === targetUser || 
                         project.members?.some(m => m.user === targetUser);
        
        if (!isMember) {
          spamWarnings.push(`User @${targetUser} is not a member of this project.`);
          continue;
        }

        // Check spam limit: max one email per sender-recipient pair in this project every 15 minutes
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const recentNotify = await db.collection('project_chat_notifications').findOne({
          sender: user.username,
          recipient: targetUser,
          projectId: project._id,
          createdAt: { $gte: fifteenMinutesAgo }
        });

        if (recentNotify) {
          spamWarnings.push(`Notification email to @${targetUser} was skipped (cooldown active).`);
          continue;
        }

        // Send Email
        if (recipient.email) {
          try {
            await sendEmail({
              to: recipient.email,
              subject: `[Upcheck] Attention Required in Project: ${project.name}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                  <h2 style="color: #ef4444; margin-top: 0;">Attention Required 🔔</h2>
                  <p>Hello <strong>${recipient.name || recipient.username}</strong>,</p>
                  <p><strong>@${user.username}</strong> mentioned you in the project <strong>${project.name}</strong> chat requiring your immediate attention.</p>
                  
                  <div style="background-color: #f9fafb; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; font-style: italic; color: #374151;">
                    "${messageText}"
                  </div>

                  <p>Please log in to the Upcheck Admin Console to respond directly in the project chat.</p>
                  <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/project_management/${id}" style="display: inline-block; padding: 10px 20px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Open Project Messages</a>
                  
                  <br/><br/>
                  <hr style="border: 0; border-top: 1px solid #eee;" />
                  <p style="font-size: 11px; color: #9ca3af; text-align: center;">This notification is rate-limited to once every 15 minutes per user to prevent spam.</p>
                </div>
              `,
              type: 'project_chat_attention'
            });

            // Save notification log
            await db.collection('project_chat_notifications').insertOne({
              sender: user.username,
              recipient: targetUser,
              projectId: project._id,
              createdAt: new Date()
            });

          } catch (emailErr) {
            console.error(`Failed to send notification email to ${recipient.email}:`, emailErr);
          }
        }
      }
    }

    const now = new Date();
    const messageDoc = {
      projectId: project._id,
      body: messageText.trim(),
      createdAt: now,
      sender: {
        userId: user._id.toString(),
        username: user.username,
        name: user.name || user.username,
        role: user.role || 'Member'
      },
      pinned: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      clientId: clientId || null
    };

    const result = await db.collection('project_messages').insertOne(messageDoc);

    return NextResponse.json({
      success: true,
      message: {
        id: result.insertedId.toString(),
        body: messageDoc.body,
        createdAt: messageDoc.createdAt,
        sender: messageDoc.sender,
        pinned: false
      },
      warnings: spamWarnings.length > 0 ? spamWarnings : undefined
    });

  } catch (error) {
    console.error('Failed to post project message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT - Toggle pin status or edit message content
export async function PUT(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = await req.json();
    const { messageId, pinToggle, newContent } = body;

    if (!ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
    }

    const message = await db.collection('project_messages').findOne({
      _id: new ObjectId(messageId),
      projectId: project._id
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Toggle Pin (Managers only)
    if (pinToggle !== undefined) {
      if (!isProjectManager(user, project)) {
        return NextResponse.json({ error: 'Forbidden: Only managers can pin/unpin messages' }, { status: 403 });
      }

      await db.collection('project_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { 
          $set: { 
            pinned: pinToggle === true,
            pinnedAt: pinToggle ? new Date() : null,
            pinnedBy: pinToggle ? user.username : null
          } 
        }
      );

      return NextResponse.json({ success: true });
    }

    // Edit message body (Sender only)
    if (newContent !== undefined) {
      if (message.sender.userId !== user._id.toString()) {
        return NextResponse.json({ error: 'Forbidden: You can only edit your own messages' }, { status: 403 });
      }

      if (!newContent.trim()) {
        return NextResponse.json({ error: 'Body cannot be empty' }, { status: 400 });
      }

      await db.collection('project_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { $set: { body: newContent.trim(), editedAt: new Date() } }
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'No valid action provided' }, { status: 400 });

  } catch (error) {
    console.error('Failed to update project message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE - Delete message (for self or for everyone)
export async function DELETE(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = await req.json();
    const { messageId, action } = body; // action: 'me' | 'everyone'

    if (!ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
    }

    const message = await db.collection('project_messages').findOne({
      _id: new ObjectId(messageId),
      projectId: project._id
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const userIdStr = user._id.toString();

    if (action === 'me') {
      // Delete for myself (append to deletedFor)
      await db.collection('project_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { $addToSet: { deletedFor: userIdStr } }
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'everyone') {
      // Delete for everyone (only message sender or project manager can do this)
      const isSender = message.sender.userId === userIdStr;
      const isManager = isProjectManager(user, project);

      if (!isSender && !isManager) {
        return NextResponse.json({ error: 'Forbidden: You cannot delete this message for everyone' }, { status: 403 });
      }

      await db.collection('project_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { 
          $set: { 
            body: '🚫 This message was deleted.', 
            isDeletedForEveryone: true,
            editedAt: new Date() 
          } 
        }
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });

  } catch (error) {
    console.error('Failed to delete project message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
