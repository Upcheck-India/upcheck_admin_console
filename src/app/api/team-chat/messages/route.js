import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendPushNotificationsBatch } from '../../../../lib/pushNotifications';
import { tryDispatchSlashCommand, postPluginResponse } from '../../../../lib/plugins/dispatch.js';
import { mediaFallbackBody } from '../../../../lib/mediaType.js';

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
      .find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();

    // Batch-resolve senders in ONE indexed $in query. The previous $lookup used
    // { $toString: "$_id" } in the join predicate, which defeats the _id index
    // and COLLSCANs admin_users once per message.
    const senderObjIds = [...new Set(messages.map(m => m.senderId).filter(Boolean))]
      .map(id => { try { return new ObjectId(id); } catch { return null; } })
      .filter(Boolean);
    const senderDocs = senderObjIds.length
      ? await db.collection('admin_users')
          .find({ _id: { $in: senderObjIds } })
          .project({ firstName: 1, lastName: 1, name: 1, username: 1, avatar: 1 })
          .toArray()
      : [];
    const userMap = senderDocs.reduce((acc, u) => { acc[u._id.toString()] = u; return acc; }, {});

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
      const details = userMap[m.senderId];
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

      const pinExpired = m.pinned && m.pinExpiresAt && new Date(m.pinExpiresAt) < new Date();
      return {
        ...m,
        _id: m._id.toString(),
        senderName: resolvedName,
        senderAvatar: resolvedAvatar,
        body: m.deletedFor?.includes(userId) ? '[Message deleted]' : m.body,
        replyTo: m.replyTo ? m.replyTo.toString() : null,
        pinned: pinExpired ? false : !!m.pinned,
        pinnedAt: pinExpired ? null : m.pinnedAt,
        pinnedBy: pinExpired ? null : m.pinnedBy,
        pinExpiresAt: pinExpired ? null : m.pinExpiresAt
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

    const { teamId, body, clientId, replyToId, mediaUrl, isForwarded, type, poll } = await request.json();
 
    if (!teamId || (!body?.trim() && !mediaUrl && type !== 'poll')) {
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
        const lockAge = Date.now() - new Date(team.botProcessingStartedAt || team.updatedAt || 0).getTime();
        if (lockAge > 120000) {
          await db.collection('teams').updateOne(
            { _id: team._id },
            { $set: { isBotProcessing: true, botProcessingStartedAt: new Date() } }
          );
        } else {
          return NextResponse.json({ error: 'Please wait. I am currently busy processing another task.' }, { status: 409 });
        }
      } else {
        const lockRes = await db.collection('teams').updateOne(
          { _id: team._id, isBotProcessing: { $ne: true } },
          { $set: { isBotProcessing: true, botProcessingStartedAt: new Date() } }
        );
        if (lockRes.modifiedCount === 0) {
          return NextResponse.json({ error: 'Please wait. I am currently busy processing another task.' }, { status: 409 });
        }
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
 
    const trimmedBody = body?.trim() || '';
    const messageType = type === 'poll' ? 'poll' : (mediaUrl ? 'image' : 'text');
    // Always give media-only messages a readable fallback body instead of ''
    // so the chat bubble isn't left completely blank if the image fails to
    // render on the client.
    const persistedBody = type === 'poll' ? `📊 Poll: ${poll?.question}` : (trimmedBody || mediaFallbackBody(mediaUrl));
 
    const now = new Date();
    const msgDoc = {
      teamId,
      senderId: currentUser._id.toString(),
      senderName,
      senderUsername: currentUser.username,
      body: persistedBody,
      type: messageType,
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(type === 'poll' ? { poll: { ...poll, votes: [] } } : {}),
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
      { $set: { lastMessageAt: now, lastMessagePreview: persistedBody.substring(0, 80) } }
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
          // Word-boundary check: a plain substring match on "@john" would
          // also fire for "@johnsmith" in the message body. Require the
          // character after the username (if any) not be a word char.
          const escaped = rUser.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const mentionPattern = new RegExp(`@${escaped}(?![a-z0-9_])`, 'i');
          if (mentionPattern.test(cleanBody)) {
            mentionedUserIds.add(rUser._id.toString());
          }
        }
      }
    }

    // Persist which users were mentioned so this doesn't need to be
    // re-derived from raw text later (e.g. for a future "mentions of me"
    // filter) — previously this was only ever computed transiently for
    // push-notification copy.
    if (mentionedUserIds.size > 0) {
      await db.collection('team_messages').updateOne(
        { _id: result.insertedId },
        { $set: { mentions: Array.from(mentionedUserIds) } }
      );
    }

    sendPushNotificationsBatch(
      nonMutedRecipients.map((recipientId) => ({
        userId: recipientId,
        title: mentionedUserIds.has(recipientId)
          ? `🚨 ${senderName} mentioned you in team ${team.name}`
          : `${senderName} in ${team.name}`,
        body: persistedBody,
        data: {
          type: 'team_message',
          teamId,
          teamName: team.name,
          messageId: result.insertedId.toString(),
          // Lets the quiet window below stay out of the way of a message that
          // is actually addressed to this person.
          isMention: mentionedUserIds.has(recipientId),
        },
      }))
    ).catch(err => console.error('[TeamChat Push Error]', err));

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

    try {
      const dispatched = await tryDispatchSlashCommand({ db, chatType: 'team', chatId: teamId, body: trimmedBody, currentUser });
      if (dispatched) {
        await postPluginResponse({
          db, chatType: 'team', chatId: teamId, currentUser,
          responseText: dispatched.responseText,
          pluginId: dispatched.pluginId, pluginName: dispatched.pluginName, pluginIcon: dispatched.pluginIcon,
        });
      }
    } catch (e) {
      console.error('Plugin dispatch error:', e);
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
