import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../../lib/auth';
import { ObjectId } from 'mongodb';
import { getSession, deleteSession, chunkPath } from '../../../../../../../lib/storage/uploadSessions.js';
import { finalizeApkUpload } from '../../../../../../../lib/appstore/finalizeUpload.js';

// POST ?uploadId= — called once every chunk has been acknowledged.
// Concatenates the chunk files in order and runs them through the same
// validate+store pipeline the old single-shot upload route used, then
// records the new version exactly as before.
export async function POST(request, { params }) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  let session = null;
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
    if (!uploadId) {
      return NextResponse.json({ error: 'uploadId is required' }, { status: 400 });
    }

    session = getSession(uploadId);
    if (!session || session.appId !== id) {
      return NextResponse.json({ error: 'Unknown or expired upload session' }, { status: 404 });
    }

    const userRole = (user.role || 'member').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'console admin' || userRole === 'console_admin';
    if (session.uploadedBy !== user._id.toString() && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.receivedChunks.size !== session.totalChunks) {
      const missing = [];
      for (let i = 0; i < session.totalChunks; i++) {
        if (!session.receivedChunks.has(i)) missing.push(i);
      }
      return NextResponse.json({ error: 'Not all chunks have been received', missingChunks: missing }, { status: 409 });
    }

    const app = await db.collection('appstore_apps').findOne({ _id: new ObjectId(id) });
    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // Re-check version uniqueness in case another upload completed for
    // this app while this one was still in progress.
    if ((app.versions || []).some(v => v.version === session.version)) {
      return NextResponse.json({ error: `Version ${session.version} already exists` }, { status: 400 });
    }

    const chunkPaths = Array.from({ length: session.totalChunks }, (_, i) => chunkPath(session, i));

    let result;
    try {
      result = await finalizeApkUpload({ db, app, session, chunkPaths });
    } catch (streamErr) {
      if (streamErr.message === 'FILE_TOO_LARGE') {
        return NextResponse.json({ error: 'Assembled file is too large.' }, { status: 400 });
      }
      if (streamErr.message === 'INVALID_APK_FORMAT') {
        return NextResponse.json({ error: 'Invalid file format. Please upload a valid Android APK file.' }, { status: 400 });
      }
      throw streamErr;
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('App Store chunked upload complete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (uploadId) await deleteSession(uploadId).catch(() => {});
  }
}
