import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { canManagePluginsForChat } from '../../../../lib/plugins/permissions.js';

const VALID_CHAT_TYPES = ['dm', 'team', 'group'];

// POST { chatType, chatId, pluginId } — same RBAC as install.
export async function POST(req) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, db } = auth;

    const { chatType, chatId, pluginId } = await req.json();

    if (!VALID_CHAT_TYPES.includes(chatType) || !chatId || !pluginId) {
      return NextResponse.json({ error: 'chatType, chatId, and pluginId are required' }, { status: 400 });
    }

    if (!(await canManagePluginsForChat(db, user, chatType, chatId))) {
      return NextResponse.json({ error: 'Forbidden: you do not have permission to manage plugins here' }, { status: 403 });
    }

    await db.collection('chat_plugin_installs').deleteOne({ chatType, chatId, pluginId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to uninstall plugin:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
