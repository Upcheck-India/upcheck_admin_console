import { ObjectId } from 'mongodb';
import { getPlugin } from './index.js';

// Distinct pseudo-sender for deterministic plugin output, kept separate from
// the AI assistant's BOT_ID ("...0001") so plugin responses are never
// confused with (or routed through) the LLM-backed bot.
export const PLUGIN_SENDER_ID = '600000000000000000000002';
export const PLUGIN_SENDER_NAME = 'Upcheck Plugins';
export const PLUGIN_SENDER_USERNAME = 'upcheck_plugins';

const SLASH_COMMAND_RE = /^\/(\S+)\s*(.*)$/s;

export function parseSlashCommand(body) {
  const match = (body || '').trim().match(SLASH_COMMAND_RE);
  if (!match) return null;
  return { command: match[1].toLowerCase(), argsText: match[2].trim() };
}

async function getInstalledPlugins(db, chatType, chatId) {
  const installs = await db.collection('chat_plugin_installs').find({ chatType, chatId }).toArray();
  return installs.map(i => ({ install: i, plugin: getPlugin(i.pluginId) })).filter(x => x.plugin);
}

/**
 * If `body` is a slash command handled by a plugin installed in this chat,
 * runs it and returns the plain-text response. Returns null if the message
 * isn't a recognized plugin command (callers should treat that as "not a
 * plugin command", not an error — the message still gets sent normally).
 *
 * No AI/LLM is ever involved here — this is a direct, synchronous,
 * deterministic function call chain: parse -> find command -> query Mongo
 * -> format text.
 */
export async function tryDispatchSlashCommand({ db, chatType, chatId, body, currentUser }) {
  const parsed = parseSlashCommand(body);
  if (!parsed) return null;

  const installed = await getInstalledPlugins(db, chatType, chatId);
  if (installed.length === 0) return null;

  if (parsed.command === 'help' && !installed.some(({ plugin }) => plugin.commands.some(c => c.name === 'help'))) {
    const lines = installed.flatMap(({ plugin }) =>
      plugin.commands.map(c => `${c.usage} — ${c.description}`)
    );
    return { pluginId: null, command: 'help', responseText: `🔌 Available commands:\n${lines.join('\n')}` };
  }

  for (const { plugin, install } of installed) {
    const command = plugin.commands.find(c => c.name === parsed.command);
    if (!command) continue;

    try {
      const responseText = await command.handler({
        db,
        currentUser,
        argsText: parsed.argsText,
        chatType,
        chatId,
        config: install.config || {},
      });
      return { pluginId: plugin.id, command: command.name, responseText };
    } catch (err) {
      console.error(`Plugin command /${parsed.command} (${plugin.id}) failed:`, err);
      return { pluginId: plugin.id, command: command.name, responseText: `⚠️ /${parsed.command} failed: ${err.message}` };
    }
  }

  return null;
}

/**
 * Posts a plugin's response as a new message in the same chat, matching
 * each chat type's existing message schema so it renders exactly like a
 * normal message (just from the "Upcheck Plugins" sender instead of a
 * person or the AI bot).
 */
export async function postPluginResponse({ db, chatType, chatId, currentUser, responseText }) {
  const now = new Date();

  if (chatType === 'dm') {
    const conversation = await db.collection('conversations').findOne({ _id: new ObjectId(chatId) });
    if (!conversation) return;
    const recipientId = (conversation.participants || []).find(p => p !== currentUser._id.toString()) || currentUser._id.toString();
    await db.collection('chat_messages').insertOne({
      conversationId: chatId,
      senderId: PLUGIN_SENDER_ID,
      recipientId,
      body: responseText,
      type: 'text',
      status: 'sent',
      createdAt: now,
      clientId: null,
      replyTo: null,
      isForwarded: false,
    });
    await db.collection('conversations').updateOne({ _id: new ObjectId(chatId) }, { $set: { lastMessageAt: now } });
    return;
  }

  if (chatType === 'team') {
    await db.collection('team_messages').insertOne({
      teamId: chatId,
      senderId: PLUGIN_SENDER_ID,
      senderName: PLUGIN_SENDER_NAME,
      senderUsername: PLUGIN_SENDER_USERNAME,
      body: responseText,
      type: 'text',
      replyTo: null,
      reactions: [],
      readBy: [{ userId: PLUGIN_SENDER_ID, readAt: now }],
      deletedForEveryone: false,
      deletedFor: [],
      clientId: null,
      createdAt: now,
      updatedAt: now,
      isForwarded: false,
    });
    await db.collection('teams').updateOne(
      { _id: new ObjectId(chatId) },
      { $set: { lastMessageAt: now, lastMessagePreview: responseText.slice(0, 80) } }
    );
    return;
  }

  if (chatType === 'group') {
    await db.collection('group_chat_messages').insertOne({
      groupId: chatId,
      senderId: PLUGIN_SENDER_ID,
      body: responseText,
      type: 'text',
      createdAt: now,
      readBy: [{ userId: PLUGIN_SENDER_ID, readAt: now }],
      deletedFor: [],
      deletedForEveryone: false,
      replyToId: null,
      replyToBody: null,
      replyToName: null,
      isForwarded: false,
      clientId: null,
    });
    await db.collection('group_chats').updateOne(
      { _id: new ObjectId(chatId) },
      { $set: { lastMessagePreview: responseText.slice(0, 80), updatedAt: now } }
    );
  }
}
