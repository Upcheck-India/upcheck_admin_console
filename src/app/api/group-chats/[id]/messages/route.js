import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { sendPushNotification } from '../../../../../lib/pushNotifications';

async function getAuthUser(req) {
  const authHeader = req.headers.get('authorization');
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const cookieStore = cookies();
    token = cookieStore.get('admin_token')?.value;
  }
  if (!token) return null;
  const client = await clientPromise;
  const db = client.db('resources');
  return await db.collection('admin_users').findOne({ sessionToken: token });
}

export async function GET(req, { params }) {
  try {
    const groupId = params.id;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    let userRole = req.headers.get('x-user-role');
    let userId = req.headers.get('x-user-id');

    if (!userRole || !userId) {
      const authUser = await getAuthUser(req);
      if (authUser) {
        userRole = authUser.role;
        userId = authUser._id.toString();
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const before = searchParams.get('before');

    // Mark messages as read
    await db.collection('group_chat_messages').updateMany(
      {
        groupId,
        senderId: { $ne: userId },
        'readBy.userId': { $ne: userId }
      },
      {
        $push: { readBy: { userId, readAt: new Date() } }
      }
    );

    const query = {
      groupId,
      deletedForEveryone: { $ne: true },
      deletedFor: { $ne: userId }
    };

    if (before && ObjectId.isValid(before)) {
      query._id = { $lt: new ObjectId(before) };
    }

    const messages = await db.collection('group_chat_messages')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Fetch user details for messages
    const userIds = [...new Set(messages.map(m => m.senderId))];
    const userIdsObj = userIds.map(id => {
      try { return new ObjectId(id); } catch { return id; }
    });
    
    const users = await db.collection('admin_users')
      .find({ _id: { $in: userIdsObj } })
      .project({ username: 1, firstName: 1, lastName: 1 })
      .toArray();
      
    const userMap = users.reduce((acc, u) => {
      acc[u._id.toString()] = u;
      return acc;
    }, {});

    const serialized = messages.map(m => {
      const sender = userMap[m.senderId];
      return {
        ...m,
        _id: m._id.toString(),
        senderName: sender ? (sender.firstName || sender.lastName ? `${sender.firstName} ${sender.lastName}`.trim() : sender.username) : 'Unknown',
        replyToId: m.replyToId ? m.replyToId.toString() : null,
        replyToBody: m.replyToBody || null,
        replyToName: m.replyToName || null,
      };
    });

    return NextResponse.json({
      messages: serialized,
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? messages[messages.length - 1]._id.toString() : null
    });
  } catch (error) {
    console.error('Error fetching group messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const groupId = params.id;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    let userRole = req.headers.get('x-user-role');
    let userId = req.headers.get('x-user-id');
    let user = null;

    if (!userRole || !userId) {
      user = await getAuthUser(req);
      if (user) {
        userRole = user.role;
        userId = user._id.toString();
      }
    } else {
      user = await db.collection('admin_users').findOne({ _id: new ObjectId(userId) });
    }

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { body, replyToId, mediaUrl, isForwarded } = await req.json();

    if (!body?.trim() && !mediaUrl) {
      return NextResponse.json({ error: 'Message body or mediaUrl is required' }, { status: 400 });
    }

    const messageType = body?.trim() ? 'text' : 'image';

    // Look up parent message to store reply snippet
    let replyToBody = null;
    let replyToName = null;
    if (replyToId && ObjectId.isValid(replyToId)) {
      try {
        const parentMsg = await db.collection('group_chat_messages').findOne({ _id: new ObjectId(replyToId) });
        if (parentMsg) {
          replyToBody = parentMsg.type === 'image' ? '📷 Image' : (parentMsg.body || '').slice(0, 200);
          const parentSender = await db.collection('admin_users').findOne(
            { _id: ObjectId.isValid(parentMsg.senderId) ? new ObjectId(parentMsg.senderId) : parentMsg.senderId },
            { projection: { firstName: 1, lastName: 1, username: 1 } }
          );
          if (parentSender) {
            replyToName = parentSender.firstName || parentSender.lastName
              ? `${parentSender.firstName || ''} ${parentSender.lastName || ''}`.trim()
              : parentSender.username;
          }
        }
      } catch (e) {}
    }

    const newMessage = {
      groupId,
      senderId: userId,
      body: body?.trim() || '',
      type: messageType,
      ...(mediaUrl ? { mediaUrl } : {}),
      createdAt: new Date(),
      readBy: [{ userId, readAt: new Date() }],
      deletedFor: [],
      deletedForEveryone: false,
      replyToId: replyToId || null,
      replyToBody: replyToBody,
      replyToName: replyToName,
      isForwarded: isForwarded || false
    };

    const result = await db.collection('group_chat_messages').insertOne(newMessage);

    if (mediaUrl) {
      const mediaIdMatch = mediaUrl.match(/\/api\/chat\/media\/([0-9a-fA-F]{24})/);
      if (mediaIdMatch && mediaIdMatch[1]) {
        await db.collection('chat_media.files').updateOne(
          { _id: new ObjectId(mediaIdMatch[1]) },
          { $inc: { 'metadata.refs': 1 } }
        );
      }
    }

    // Update group's last message preview
    await db.collection('group_chats').updateOne(
      { _id: new ObjectId(groupId) },
      { 
        $set: { 
          lastMessagePreview: body?.trim() || '📷 Image',
          updatedAt: new Date()
        } 
      }
    );

    // Send push notifications to group members
    try {
      const group = await db.collection('group_chats').findOne({ _id: new ObjectId(groupId) });
      if (group) {
        // Find team documents to resolve members
        const groupTeams = await db.collection('teams').find({
          _id: { $in: (group.teams || []).map(id => new ObjectId(id)) }
        }).toArray();

        const allMemberIds = new Set();
        if (group.members) {
          group.members.forEach(m => allMemberIds.add(m.toString()));
        }
        groupTeams.forEach(t => {
          if (t.lead) allMemberIds.add(t.lead.toString());
          if (t.members) {
            t.members.forEach(m => allMemberIds.add(m.toString()));
          }
        });

        // Filter out sender and excluded members
        const excludedSet = new Set((group.excludedMembers || []).map(m => m.toString()));
        const uniqueRecipients = [...allMemberIds].filter(
          id => id !== userId && !excludedSet.has(id)
        );

        // Filter out recipients who have muted this group chat
        const activeGroupMutes = await db.collection('chat_mutes').find({
          chatId: groupId,
          chatType: 'group'
        }).toArray();

        const mutedUserIds = new Set(
          activeGroupMutes
            .filter(m => m.isForever || (m.mutedUntil && new Date(m.mutedUntil) > new Date()))
            .map(m => m.userId)
        );

        const nonMutedRecipients = uniqueRecipients.filter(
          id => !mutedUserIds.has(id)
        );

        // Parse mentions
        const cleanBody = body?.trim() || '';
        const lowerBody = cleanBody.toLowerCase();
        const isMentionAll = lowerBody.includes('@everyone') || lowerBody.includes('@all') || lowerBody.includes('@here');
        
        let mentionedUserIds = new Set();
        if (isMentionAll) {
          nonMutedRecipients.forEach(id => mentionedUserIds.add(id));
        } else {
          const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
          const matches = [...cleanBody.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
          if (matches.length > 0) {
            const users = await db.collection('admin_users').find({
              username: { $in: matches }
            }, { projection: { _id: 1 } }).toArray();
            users.forEach(u => {
              const uIdStr = u._id.toString();
              if (nonMutedRecipients.includes(uIdStr)) {
                mentionedUserIds.add(uIdStr);
              }
            });
          }
        }

        const senderName = user.firstName || user.lastName
          ? `${user.firstName} ${user.lastName}`.trim()
          : user.username;

        for (const recipientId of nonMutedRecipients) {
          const isMentioned = mentionedUserIds.has(recipientId);
          const title = isMentioned 
            ? `🚨 ${senderName} mentioned you in group ${group.name}`
            : `${senderName} in group ${group.name}`;

          sendPushNotification(
            recipientId,
            title,
            body?.trim() || '📷 Image',
            { type: 'group_message', groupId, groupName: group.name }
          ).catch(err => console.error('[GroupChat Push Error]', err));
        }
      }
    } catch (pushErr) {
      console.error('Failed to trigger group chat push notifications:', pushErr);
    }

    return NextResponse.json({
      message: {
        ...newMessage,
        _id: result.insertedId.toString(),
        senderName: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.username
      }
    });
  } catch (error) {
    console.error('Error sending group message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
