import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendPushNotification } from '../../../../lib/pushNotifications';

import { getAuthUser } from '../../../../lib/auth';

async function verifyTeamMember(db, teamId, userId) {
  if (!ObjectId.isValid(teamId)) return null;
  const team = await db.collection('teams').findOne({
    _id: new ObjectId(teamId),
    $or: [
      { members: userId },
      { lead: userId },
      { members: new ObjectId(userId) },
      { lead: new ObjectId(userId) },
    ],
  });
  return team;
}

export async function GET(request) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = authData.user;

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const before = searchParams.get('before'); // ObjectId cursor

    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');

    const team = await verifyTeamMember(db, teamId, currentUser._id.toString());
    if (!team) return NextResponse.json({ error: 'Not a team member' }, { status: 403 });

    // Build query
    const query = { 
      teamId, 
      deletedForEveryone: { $ne: true },
      deletedFor: { $ne: currentUser._id.toString() }
    };
    if (before && ObjectId.isValid(before)) {
      query._id = { $lt: new ObjectId(before) };
    }

    const messages = await db.collection('team_messages')
      .aggregate([
        { $match: query },
        { $sort: { _id: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'admin_users',
            let: { senderId: "$senderId" },
            pipeline: [
              { $match: { $expr: { $eq: [ { $toString: "$_id" }, "$$senderId" ] } } },
              { $project: { firstName: 1, lastName: 1, name: 1, username: 1, avatar: 1 } }
            ],
            as: 'senderDetails'
          }
        }
      ])
      .toArray();

    // Mark messages as read for current user
    const msgIds = messages.map(m => m._id);
    if (msgIds.length > 0) {
      await db.collection('team_messages').updateMany(
        {
          _id: { $in: msgIds },
          'readBy.userId': { $ne: currentUser._id.toString() },
          senderId: { $ne: currentUser._id.toString() },
        },
        {
          $push: { readBy: { userId: currentUser._id.toString(), readAt: new Date() } }
        }
      );
    }

    // Filter out messages deleted for current user and resolve sender info
    const userId = currentUser._id.toString();
    const filtered = messages.map(m => {
      const details = m.senderDetails?.[0];
      let resolvedName = m.senderName;
      if (details) {
        if (details.firstName || details.lastName) {
          resolvedName = `${details.firstName || ''} ${details.lastName || ''}`.trim();
        } else if (details.name) {
          resolvedName = details.name;
        } else if (details.username) {
          resolvedName = details.username;
        }
      }
      if (!resolvedName) {
        resolvedName = m.senderUsername || 'Unknown';
      }

      const resolvedAvatar = details?.avatar || m.senderAvatar || '';

      return {
        ...m,
        _id: m._id.toString(),
        senderName: resolvedName,
        senderAvatar: resolvedAvatar,
        body: m.deletedFor?.includes(userId) ? '[Message deleted]' : m.body,
        replyTo: m.replyTo ? m.replyTo.toString() : null,
        senderDetails: undefined,
      };
    });

    return NextResponse.json({
      messages: filtered,
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? messages[messages.length - 1]._id.toString() : null,
    });
  } catch (err) {
    console.error('Team chat messages GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = authData.user;

    const { teamId, body, clientId, replyToId, mediaUrl, isForwarded } = await request.json();

    if (!teamId || (!body?.trim() && !mediaUrl)) {
      return NextResponse.json({ error: 'teamId and body (or mediaUrl) required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const team = await verifyTeamMember(db, teamId, currentUser._id.toString());
    if (!team) return NextResponse.json({ error: 'Not a team member' }, { status: 403 });

    const botId = "600000000000000000000001";
    const cleanBody = body?.trim() || '';
    const isBotMentioned = cleanBody.toLowerCase().includes('@upcheck_admin_bot');
    const isBotMember = team.members && team.members.some(m => m.toString() === botId);

    if (isBotMember && isBotMentioned) {
      if (team.isBotProcessing) {
        return NextResponse.json({ error: 'Please wait. I am currently busy processing another task.' }, { status: 409 });
      }
      const lockRes = await db.collection('teams').updateOne(
        { _id: team._id, isBotProcessing: { $ne: true } },
        { $set: { isBotProcessing: true } }
      );
      if (lockRes.modifiedCount === 0) {
        return NextResponse.json({ error: 'Please wait. I am currently busy processing another task.' }, { status: 409 });
      }
    }

    // Idempotency check
    if (clientId) {
      const existing = await db.collection('team_messages').findOne({ clientId });
      if (existing) {
        return NextResponse.json({ message: { ...existing, _id: existing._id.toString() } });
      }
    }

    const senderName = currentUser.firstName && currentUser.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
      : currentUser.username;

    const messageType = body?.trim() ? 'text' : 'image';

    const now = new Date();
    const msgDoc = {
      teamId,
      senderId: currentUser._id.toString(),
      senderName,
      senderUsername: currentUser.username,
      body: body?.trim() || '',
      type: messageType,
      ...(mediaUrl ? { mediaUrl } : {}),
      replyTo: replyToId && ObjectId.isValid(replyToId) ? new ObjectId(replyToId) : null,
      reactions: [],
      readBy: [{ userId: currentUser._id.toString(), readAt: now }],
      deletedForEveryone: false,
      deletedFor: [],
      clientId: clientId || null,
      createdAt: now,
      updatedAt: now,
      isForwarded: isForwarded || false
    };
    
    // Add senderAvatar for immediate response
    const returnMsgDoc = { ...msgDoc, senderAvatar: currentUser.avatar };

    const result = await db.collection('team_messages').insertOne(msgDoc);

    if (mediaUrl) {
      const mediaIdMatch = mediaUrl.match(/\/api\/chat\/media\/([0-9a-fA-F]{24})/);
      if (mediaIdMatch && mediaIdMatch[1]) {
        await db.collection('chat_media.files').updateOne(
          { _id: new ObjectId(mediaIdMatch[1]) },
          { $inc: { 'metadata.refs': 1 } }
        );
      }
    }

    // Update team's lastMessageAt for unread counting
    await db.collection('teams').updateOne(
      { _id: new ObjectId(teamId) },
      { $set: { lastMessageAt: now, lastMessagePreview: body?.trim()?.substring(0, 80) || '📷 Image' } }
    );

    // Send push notifications to all team members except sender
    const allMemberIds = [
      ...(team.members || []).map(m => m.toString()),
    ];
    if (team.lead) allMemberIds.push(team.lead.toString());
    const uniqueRecipients = [...new Set(allMemberIds)].filter(
      id => id !== currentUser._id.toString()
    );

    // Fetch active mutes for this team chat
    const activeTeamMutes = await db.collection('chat_mutes').find({
      chatId: teamId,
      chatType: 'team'
    }).toArray();

    const mutedUserIds = new Set(
      activeTeamMutes
        .filter(m => m.isForever || (m.mutedUntil && new Date(m.mutedUntil) > new Date()))
        .map(m => m.userId)
    );

    const nonMutedRecipients = uniqueRecipients.filter(
      id => !mutedUserIds.has(id)
    );

    // Parse mentions
    const lowerBody = cleanBody.toLowerCase();
    const isMentionAll = lowerBody.includes('@everyone') || lowerBody.includes('@all') || lowerBody.includes('@here');
    
    let mentionedUserIds = new Set();
    if (isMentionAll) {
      nonMutedRecipients.forEach(id => mentionedUserIds.add(id));
    } else {
      const recipientObjIds = nonMutedRecipients.map(id => {
        try { return new ObjectId(id); } catch { return id; }
      });
      const recipientUsers = await db.collection('admin_users').find({
        _id: { $in: recipientObjIds }
      }, { projection: { username: 1 } }).toArray();

      for (const rUser of recipientUsers) {
        if (rUser.username) {
          const mentionTag = `@${rUser.username.toLowerCase()}`;
          if (lowerBody.includes(mentionTag)) {
            mentionedUserIds.add(rUser._id.toString());
          }
        }
      }
    }

    for (const recipientId of nonMutedRecipients) {
      const isMentioned = mentionedUserIds.has(recipientId);
      const title = isMentioned 
        ? `🚨 ${senderName} mentioned you in team ${team.name}`
        : `${senderName} in ${team.name}`;

      sendPushNotification(
        recipientId,
        title,
        body?.trim() || '📷 Image',
        { type: 'team_message', teamId, teamName: team.name }
      ).catch(err => console.error('[TeamChat Push Error]', err));
    }

    if (isBotMember && isBotMentioned) {
      import('../../../../lib/botAgent.js').then(({ triggerBotAgent }) => {
        triggerBotAgent({
          chatType: 'team',
          chatId: teamId,
          body: cleanBody,
          currentUser,
          db
        }).catch(e => console.error('Team Bot execution error:', e));
      });
    }

    return NextResponse.json({
      message: {
        ...returnMsgDoc,
        _id: result.insertedId.toString(),
        replyTo: replyToId || null,
      }
    });
  } catch (err) {
    console.error('Team chat messages POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
