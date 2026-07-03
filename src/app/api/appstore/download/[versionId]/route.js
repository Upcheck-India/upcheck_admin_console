import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/auth';
import { ObjectId } from 'mongodb';
import { getProviderForVersion } from '../../../../../lib/storage/index.js';

export async function GET(request, { params }) {
  try {
    const { versionId } = await params;
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    if (!versionId || !ObjectId.isValid(versionId)) {
      return NextResponse.json({ error: 'Invalid version ID' }, { status: 400 });
    }

    const objectVersionId = new ObjectId(versionId);

    // 1. Find the parent app containing this version — versions are
    // identified by their own stable _id regardless of which storage
    // backend actually holds the bytes (fileId/blobUrl/utKey), so this
    // lookup and everything downstream works the same for every provider.
    const app = await db.collection('appstore_apps').findOne({
      'versions._id': objectVersionId
    });

    if (!app) {
      return NextResponse.json({ error: 'App or version file not found' }, { status: 404 });
    }

    const version = (app.versions || []).find(v => v._id?.toString() === versionId);
    if (!version) {
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

    // 4. Increment download counter
    await db.collection('appstore_apps').updateOne(
      { _id: app._id },
      { $inc: { downloadCount: 1 } }
    );

    // 5. Stream from whichever backend this version was actually stored
    // with — the app's globally active provider may have changed since
    // this version was uploaded, so we branch on the version's own record.
    const provider = getProviderForVersion(version);
    const download = await provider.getDownloadStream(db, version);
    if (!download) {
      return NextResponse.json({ error: 'Binary file not found in storage' }, { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${version.filename || 'app.apk'}"`);
    headers.set('Content-Type', download.contentType || 'application/vnd.android.package-archive');
    if (download.size) headers.set('Content-Length', download.size.toString());

    return new Response(download.webStream, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('App Store apps download GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
