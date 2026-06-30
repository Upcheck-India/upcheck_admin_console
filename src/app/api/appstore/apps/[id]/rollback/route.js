import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid app ID' }, { status: 400 });
    }

    const app = await db.collection('appstore_apps').findOne({ _id: new ObjectId(id) });
    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // Check permissions (Admin or distributor)
    const userRole = user.role || 'member';
    const isAdmin = userRole === 'admin' || userRole === 'console_admin';
    const isDistributor = app.distributorId === user._id.toString();

    if (!isAdmin && !isDistributor) {
      return NextResponse.json({ error: 'Forbidden: Only admins or the original publisher can rollback versions' }, { status: 403 });
    }

    const body = await request.json();
    const { version } = body;

    if (!version) {
      return NextResponse.json({ error: 'Version string is required' }, { status: 400 });
    }

    const versions = app.versions || [];
    const targetVersion = versions.find(v => v.version === version.trim());
    if (!targetVersion) {
      return NextResponse.json({ error: 'Version not found in version history' }, { status: 404 });
    }

    // Set the latestVersion value to targetVersion.version
    // and reorder versions array so that targetVersion is at the end (denoting current latest)
    const remainingVersions = versions.filter(v => v.version !== version.trim());
    const reorderedVersions = [...remainingVersions, targetVersion];

    await db.collection('appstore_apps').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          latestVersion: version.trim(),
          versions: reorderedVersions,
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      latestVersion: version.trim(),
      message: `App rolled back to version ${version.trim()}`
    });
  } catch (error) {
    console.error('App Store apps rollback error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
