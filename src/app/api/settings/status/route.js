import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { getStatusSettings, updateStatusSettings } from '../../../../lib/status/settings';
import { isMusicConfigured } from '../../../../lib/music/jiosaavn';

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { db } = auth;

    const settings = await getStatusSettings(db);
    return NextResponse.json({ success: true, settings, musicConfigured: isMusicConfigured() });
  } catch (error) {
    console.error('Status settings GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    // Matches the canonical console-admin access list (see
    // console-admin/layout.js) — this route previously used a narrower,
    // differently-normalized list that silently 403'd admins whose role was
    // 'superadmin'/'administrator', making every settings save no-op.
    const normalizedRole = (user.role || 'member').toString().toLowerCase().replace(/\s+/g, '_');
    if (!['admin', 'console_admin', 'superadmin', 'administrator'].includes(normalizedRole)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const settings = await updateStatusSettings(db, {
      statusEnabled: body.statusEnabled,
      musicEnabled: body.musicEnabled,
      retentionHours: body.retentionHours,
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Status settings PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
