import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import {
  getMediaSettings,
  updateMediaSettings,
  MEDIA_FEATURES,
  MEDIA_PROVIDERS,
} from '../../../../lib/media/settings';
import { isCloudinaryConfigured } from '../../../../lib/media/cloudinary';

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { db } = auth;

    const settings = await getMediaSettings(db);
    return NextResponse.json({
      success: true,
      settings,
      cloudinaryConfigured: isCloudinaryConfigured(),
    });
  } catch (error) {
    console.error('Media settings GET error:', error);
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
    // console-admin/layout.js) rather than a narrower, differently-normalized
    // list that would silently 403 admins whose role is 'superadmin'/
    // 'administrator'.
    const normalizedRole = (user.role || 'member').toString().toLowerCase().replace(/\s+/g, '_');
    if (!['admin', 'console_admin', 'superadmin', 'administrator'].includes(normalizedRole)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const patch = {};

    if (typeof body.cloudinaryEnabled === 'boolean') {
      patch.cloudinaryEnabled = body.cloudinaryEnabled;
    }

    if (body.providers && typeof body.providers === 'object') {
      patch.providers = {};
      for (const feature of MEDIA_FEATURES) {
        const value = body.providers[feature];
        if (MEDIA_PROVIDERS.includes(value)) {
          patch.providers[feature] = value;
        }
      }
    }

    const settings = await updateMediaSettings(db, patch);
    return NextResponse.json({
      success: true,
      settings,
      cloudinaryConfigured: isCloudinaryConfigured(),
    });
  } catch (error) {
    console.error('Media settings PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
