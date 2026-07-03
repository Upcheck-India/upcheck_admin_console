import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { getPlugin, pluginSupportsChatType } from '../../../../lib/plugins/index.js';
import { canManagePluginsForChat } from '../../../../lib/plugins/permissions.js';

const VALID_CHAT_TYPES = ['dm', 'team', 'group'];

// POST { chatType, chatId, pluginId, config? }
// RBAC: Team lead / Group admin / platform Admin / Console admin (DM: any
// participant, since a DM has no hierarchy).
export async function POST(req) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, db } = auth;

    const { chatType, chatId, pluginId, config } = await req.json();

    if (!VALID_CHAT_TYPES.includes(chatType) || !chatId || !pluginId) {
      return NextResponse.json({ error: 'chatType, chatId, and pluginId are required' }, { status: 400 });
    }

    const plugin = getPlugin(pluginId);
    if (!plugin) {
      return NextResponse.json({ error: 'Unknown plugin' }, { status: 404 });
    }
    if (!pluginSupportsChatType(plugin, chatType)) {
      return NextResponse.json({ error: `${plugin.name} isn't available for this chat type` }, { status: 400 });
    }

    if (!(await canManagePluginsForChat(db, user, chatType, chatId))) {
      return NextResponse.json({ error: 'Forbidden: you do not have permission to install plugins here' }, { status: 403 });
    }

    await db.collection('chat_plugin_installs').updateOne(
      { chatType, chatId, pluginId },
      {
        $set: { config: config || {} },
        $setOnInsert: {
          chatType,
          chatId,
          pluginId,
          installedBy: user._id.toString(),
          installedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to install plugin:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
