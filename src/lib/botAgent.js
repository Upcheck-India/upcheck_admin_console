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
      description: "List upcoming meetings and calendar events in the workspace. Returns titles, descriptions, timings, and participant lists.",
      parameters: { type: "object", properties: {} }
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
      description: "View the workspace directory of users, containing usernames, display names, emails, roles, and departments.",
      parameters: { type: "object", properties: {} }
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
      const events = await db.collection('events').find({
        $or: [
          { hostId: currentUser._id.toString() },
          { host: userEmail },
          { participants: userEmail }
        ]
      }).sort({ startTime: 1 }).toArray();

      return JSON.stringify(events.map(e => ({
        id: e._id.toString(),
        title: e.title,
        description: e.description,
        startTime: e.startTime,
        duration: e.duration,
        host: e.host,
        joinUrl: e.joinUrl || e.zoomMeetingUrl,
        participants: e.participants
      })));
    }

    if (name === 'create_meeting') {
      if (userRole === 'Intern') {
        return JSON.stringify({ error: `Permission Denied: Users with role '${userRole}' are not authorized to create meetings.` });
      }

      const { title, description, startTime, duration, provider = 'google_meet', participants = [] } = args;
      
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
        sendNotification: true,
        createdAt: new Date(),
        provider: provider,
        joinUrl: `https://meet.google.com/${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`
      };

      await db.collection('events').insertOne(eventData);

      // Trigger push notifications
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
      const users = await db.collection('admin_users').find(
        { role: { $ne: 'bot' } },
        { projection: { password: 0, sessionToken: 0, backupCodes: 0 } }
      ).toArray();

      return JSON.stringify(users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        name: u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username,
        email: u.email,
        role: u.role,
        department: u.department,
        jobTitle: u.jobTitle
      })));
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
    let messages = [
      {
        role: "system",
        content: `You are the "Upcheck Admin Bot". You have access to administrative tools to list/create meetings, list teams, and list users in the workspace.
You carry out operations strictly on behalf of the prompting user. The current user is ${currentUser.firstName || ''} ${currentUser.lastName || ''} (${currentUser.email}) with role ${currentUser.role || 'Member'}.
Always be helpful, precise, and state clearly when you perform actions on behalf of the user.`
      }
    ];

    if (chatType === 'dm') {
      const history = await db.collection('chat_messages')
        .find({ conversationId: chatId, status: { $ne: 'streaming' } })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
      
      history.reverse().forEach(m => {
        messages.push({
          role: m.senderId === BOT_ID ? 'assistant' : 'user',
          content: m.body
        });
      });
    } else if (chatType === 'group') {
      const history = await db.collection('group_chat_messages')
        .find({ groupId: chatId, status: { $ne: 'streaming' } })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
      
      history.reverse().forEach(m => {
        messages.push({
          role: m.senderId === BOT_ID ? 'assistant' : 'user',
          content: m.body
        });
      });
    } else {
      const history = await db.collection('team_messages')
        .find({ teamId: chatId, status: { $ne: 'streaming' } })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
      
      history.reverse().forEach(m => {
        messages.push({
          role: m.senderId === BOT_ID ? 'assistant' : 'user',
          content: m.body
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
            list_meetings: "Thinking... Listing upcoming meetings...",
            create_meeting: "Thinking... Scheduling a new meeting...",
            list_teams: "Thinking... Loading workspace teams...",
            list_users: "Thinking... Querying user directory..."
          };
          const statusMsg = toolStatusMap[tc.function.name] || `Thinking... Running action ${tc.function.name}...`;
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
