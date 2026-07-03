import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../lib/auth';
import { listPlugins } from '../../../lib/plugins/index.js';

// GET - list every registered plugin (metadata + command list), regardless
// of what's installed where. Used to populate an "install a plugin" picker.
export async function GET(req) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ plugins: listPlugins() });
}
