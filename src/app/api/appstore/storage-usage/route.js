import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { getAllProvidersUsage } from '../../../../lib/storage/index.js';

// GET — usage/limits for every App Store storage provider (not just the
// active one), so the Store Settings screen can show "here's what each
// option costs you" before an admin switches. Admin-only since it reveals
// infrastructure details (bandwidth/storage consumption).
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    const userRole = (user.role || 'member').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'console admin' || userRole === 'console_admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const providers = await getAllProvidersUsage(db);
    return NextResponse.json({ success: true, providers });
  } catch (error) {
    console.error('App Store storage usage error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
