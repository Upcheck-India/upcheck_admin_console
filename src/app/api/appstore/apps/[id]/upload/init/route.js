import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../../lib/auth';
import { ObjectId } from 'mongodb';
import { createSession } from '../../../../../../../lib/storage/uploadSessions.js';
import { VERSION_RE, MAX_APK_SIZE_BYTES } from '../../../../../../../lib/appstore/finalizeUpload.js';

const MAX_CHUNKS = 4096; // generous upper bound — at an 8MB client chunk size this covers 32GB, far above MAX_APK_SIZE_BYTES

// POST — starts a chunked upload: does every upfront check that used to
// happen inline in the old single-shot upload route (auth, RBAC, kill
// switches, version format/uniqueness, size cap) once, so individual
// chunk requests can stay lightweight and don't each need to repeat this
// logic. Returns an uploadId the client includes on every /chunk call.
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

    const userRole = (user.role || 'member').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'console admin' || userRole === 'console_admin';
    const isDistributor = app.distributorId === user._id.toString();
    if (!isAdmin && !isDistributor) {
      return NextResponse.json({ error: 'Forbidden: Only admins or the original publisher can upload updates' }, { status: 403 });
    }

    const versions = app.versions || [];
    const isUpdate = versions.length > 0;
    const settings = await db.collection('appstore_settings').findOne({});
    if (!isAdmin) {
      if (!isUpdate && settings?.uploadsDisabled) {
        return NextResponse.json({ error: 'App uploads are currently disabled by an administrator' }, { status: 403 });
      }
      if (isUpdate && settings?.updatesDisabled) {
        return NextResponse.json({ error: 'App updates are currently disabled by an administrator' }, { status: 403 });
      }
    }

    const body = await request.json();
    const version = (body.version || '').trim();
    const changelog = (body.changelog || '').trim();
    const filename = (body.filename || 'app-release.apk').trim();
    const totalSize = Number(body.totalSize);
    const totalChunks = Number(body.totalChunks);

    if (!version) {
      return NextResponse.json({ error: 'Version is required' }, { status: 400 });
    }
    if (!VERSION_RE.test(version)) {
      return NextResponse.json({ error: 'Version must look like 1.0 or 1.0.0 (numeric segments, optional -suffix)' }, { status: 400 });
    }
    if (changelog.length > 2000) {
      return NextResponse.json({ error: 'Release notes must be 2000 characters or fewer' }, { status: 400 });
    }
    if (!Number.isFinite(totalSize) || totalSize <= 0) {
      return NextResponse.json({ error: 'A valid totalSize is required' }, { status: 400 });
    }
    if (totalSize > MAX_APK_SIZE_BYTES) {
      return NextResponse.json({ error: `File is too large. Maximum size is ${MAX_APK_SIZE_BYTES / (1024 * 1024)}MB` }, { status: 400 });
    }
    if (!Number.isInteger(totalChunks) || totalChunks <= 0 || totalChunks > MAX_CHUNKS) {
      return NextResponse.json({ error: 'Invalid chunk count' }, { status: 400 });
    }

    const versionExists = versions.some(v => v.version === version);
    if (versionExists) {
      return NextResponse.json({ error: `Version ${version} already exists` }, { status: 400 });
    }

    const session = await createSession({
      appId: id,
      version,
      changelog,
      filename,
      totalSize,
      totalChunks,
      uploadedBy: user._id.toString(),
    });

    return NextResponse.json({ success: true, uploadId: session.uploadId });
  } catch (error) {
    console.error('App Store chunked upload init error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
