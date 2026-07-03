import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { isChatParticipant } from '../../../../lib/plugins/permissions.js';
import { searchTasksForMention } from '../../../../lib/plugins/projectManagement/queries.js';

const VALID_CHAT_TYPES = ['dm', 'team', 'group'];
const PLUGIN_ID = 'project-management';

// GET ?chatType=&chatId=&q= — backs the "#" task-mention autocomplete in
// the composer. Only returns results if the Project Management plugin is
// actually installed in this chat, and scopes the search the same way the
// plugin's own commands do (see searchTasksForMention).
export async function GET(req) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, db } = auth;

    const { searchParams } = new URL(req.url);
    const chatType = searchParams.get('chatType');
    const chatId = searchParams.get('chatId');
    const q = searchParams.get('q') || '';

    if (!VALID_CHAT_TYPES.includes(chatType) || !chatId) {
      return NextResponse.json({ error: 'chatType and chatId are required' }, { status: 400 });
    }

    if (!(await isChatParticipant(db, user, chatType, chatId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const install = await db.collection('chat_plugin_installs').findOne({ chatType, chatId, pluginId: PLUGIN_ID });
    if (!install) {
      return NextResponse.json({ tasks: [] });
    }

    const tasks = await searchTasksForMention(db, user, install.config || {}, q);
    return NextResponse.json({
      tasks: tasks.map(t => ({
        _id: t._id.toString(),
        title: t.title,
        status: t.status,
        priority: t.priority || 'Medium',
      })),
    });
  } catch (error) {
    console.error('Task mention search failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
