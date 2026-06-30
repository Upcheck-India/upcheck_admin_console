import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/auth';
import { GridFSBucket, ObjectId } from 'mongodb';

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

    const userRole = user.role || 'member';
    const isAdmin = userRole === 'admin' || userRole === 'console_admin';
    const isDistributor = app.distributorId === user._id.toString();

    // 2. Enforce download visibility permissions check
    if (!isAdmin && !isDistributor) {
      const access = app.accessSettings;
      if (access && !access.availableToAll) {
        const userTeams = await db.collection('teams').find({
          members: user._id.toString()
        }).toArray();
        const teamIds = userTeams.map(t => t._id.toString());

        const roleMatch = (access.allowedRoles || []).includes(userRole);
        const userMatch = (access.allowedUsers || []).includes(user._id.toString());
        const teamMatch = (access.allowedTeams || []).some(tId => teamIds.includes(tId.toString()));

        if (!roleMatch && !userMatch && !teamMatch) {
          return NextResponse.json({ error: 'Forbidden: You do not have access to view this app' }, { status: 403 });
        }
      }

      // Enforce download permissions check (restricted field)
      const downloadPerms = app.accessSettings?.downloadPermissions;
      if (downloadPerms?.restricted) {
        const userTeams = await db.collection('teams').find({
          members: user._id.toString()
        }).toArray();
        const teamIds = userTeams.map(t => t._id.toString());

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
    const chunks = [];
    const downloadStream = bucket.openDownloadStream(objectFileId);

    await new Promise((resolve, reject) => {
      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      downloadStream.on('error', (error) => {
        reject(error);
      });
      downloadStream.on('end', () => {
        resolve();
      });
    });

    const fileBuffer = Buffer.concat(chunks);

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${file.filename}"`);
    headers.set('Content-Type', file.contentType || 'application/vnd.android.package-archive');
    headers.set('Content-Length', fileBuffer.length.toString());

    return new Response(fileBuffer, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('App Store apps download GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
