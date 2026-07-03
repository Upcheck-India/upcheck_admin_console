import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/auth';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

export async function GET(request, { params }) {
  try {
    const { fileId } = await params;
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    if (!fileId || !ObjectId.isValid(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const objectFileId = new ObjectId(fileId);

    // 1. Find the parent app containing this version
    const app = await db.collection('appstore_apps').findOne({
      "versions.fileId": objectFileId
    });

    if (!app) {
      return NextResponse.json({ error: 'App or version file not found' }, { status: 404 });
    }

    const userRole = (user.role || 'member').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'console admin' || userRole === 'console_admin';
    const isDistributor = app.distributorId === user._id.toString();

    // 2. Global downloads kill switch — admins/distributor always retain access.
    if (!isAdmin && !isDistributor) {
      const settings = await db.collection('appstore_settings').findOne({});
      if (settings?.downloadsDisabled) {
        return NextResponse.json({ error: 'Downloads are currently disabled by an administrator' }, { status: 403 });
      }
    }

    // 3. Enforce download visibility permissions check
    if (!isAdmin && !isDistributor) {
      const access = app.accessSettings;
      const userTeams = await db.collection('teams').find({
        members: user._id.toString()
      }).toArray();
      const teamIds = userTeams.map(t => t._id.toString());

      if (access) {
        const isExcluded = (access.excludedRoles || []).includes(userRole)
          || (access.excludedUsers || []).includes(user._id.toString())
          || (access.excludedTeams || []).some(tId => teamIds.includes(tId.toString()));
        if (isExcluded) {
          return NextResponse.json({ error: 'Forbidden: You do not have access to view this app' }, { status: 403 });
        }

        if (!access.availableToAll) {
          const roleMatch = (access.allowedRoles || []).includes(userRole);
          const userMatch = (access.allowedUsers || []).includes(user._id.toString());
          const teamMatch = (access.allowedTeams || []).some(tId => teamIds.includes(tId.toString()));

          if (!roleMatch && !userMatch && !teamMatch) {
            return NextResponse.json({ error: 'Forbidden: You do not have access to view this app' }, { status: 403 });
          }
        }
      }

      // Enforce download permissions check (restricted field)
      const downloadPerms = app.accessSettings?.downloadPermissions;
      const isDownloadExcluded = (downloadPerms?.excludedRoles || []).includes(userRole)
        || (downloadPerms?.excludedUsers || []).includes(user._id.toString())
        || (downloadPerms?.excludedTeams || []).some(tId => teamIds.includes(tId.toString()));

      if (isDownloadExcluded) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to download this app' }, { status: 403 });
      }

      if (downloadPerms?.restricted) {
        const roleMatch = (downloadPerms.allowedRoles || []).includes(userRole);
        const userMatch = (downloadPerms.allowedUsers || []).includes(user._id.toString());
        const teamMatch = (downloadPerms.allowedTeams || []).some(tId => teamIds.includes(tId.toString()));

        if (!roleMatch && !userMatch && !teamMatch) {
          return NextResponse.json({ error: 'Forbidden: You do not have permission to download this app' }, { status: 403 });
        }
      }
    }

    // 3. Increment download counter
    await db.collection('appstore_apps').updateOne(
      { _id: app._id },
      { $inc: { downloadCount: 1 } }
    );

    // 4. Download from GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'appstore_apks' });
    const filesCursor = bucket.find({ _id: objectFileId });
    const files = await filesCursor.toArray();

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Binary file not found in storage' }, { status: 404 });
    }

    const file = files[0];
    // Stream straight from GridFS to the response instead of buffering the
    // whole APK in memory first — the old Buffer.concat() approach held the
    // entire file (and a full copy of it) in RAM and didn't send a single
    // byte to the client until the whole thing had been read from Mongo,
    // which is both slow and a likely contributor to gateway timeouts on
    // larger files.
    const downloadStream = bucket.openDownloadStream(objectFileId);
    const webStream = Readable.toWeb(downloadStream);

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${file.filename}"`);
    headers.set('Content-Type', file.contentType || 'application/vnd.android.package-archive');
    headers.set('Content-Length', file.length.toString());

    return new Response(webStream, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('App Store apps download GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
