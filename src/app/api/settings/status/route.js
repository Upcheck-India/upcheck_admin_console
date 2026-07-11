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

    const userRole = (user.role || 'member').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'console admin' && userRole !== 'console_admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const settings = await updateStatusSettings(db, {
      statusEnabled: body.statusEnabled,
      retentionHours: body.retentionHours,
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Status settings PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
