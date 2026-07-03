import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { getPlugin } from '../../../../lib/plugins/index.js';
import { isChatParticipant, canManagePluginsForChat } from '../../../../lib/plugins/permissions.js';

const VALID_CHAT_TYPES = ['dm', 'team', 'group'];

// GET ?chatType=&chatId= - list plugins installed in a specific chat.
// Readable by any participant (not just admins) so everyone in the chat
// can see what's available/installed.
export async function GET(req) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, db } = auth;

    const { searchParams } = new URL(req.url);
    const chatType = searchParams.get('chatType');
    const chatId = searchParams.get('chatId');

    if (!VALID_CHAT_TYPES.includes(chatType) || !chatId) {
      return NextResponse.json({ error: 'chatType and chatId are required' }, { status: 400 });
    }

    if (!(await isChatParticipant(db, user, chatType, chatId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const installs = await db.collection('chat_plugin_installs').find({ chatType, chatId }).toArray();
    const installed = installs
      .map(i => {
        const plugin = getPlugin(i.pluginId);
        if (!plugin) return null;
        return {
          pluginId: plugin.id,
          name: plugin.name,
          description: plugin.description,
          icon: plugin.icon,
          commands: plugin.commands.map(c => ({ name: c.name, usage: c.usage, description: c.description })),
          config: i.config || {},
          installedBy: i.installedBy,
          installedAt: i.installedAt,
        };
      })
      .filter(Boolean);

    const canManage = await canManagePluginsForChat(db, user, chatType, chatId);

    return NextResponse.json({ installed, canManage });
  } catch (error) {
    console.error('Failed to list installed plugins:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
