import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../../lib/auth';
import { ObjectId } from 'mongodb';
import { getSession, deleteSession, chunkPath } from '../../../../../../../lib/storage/uploadSessions.js';
import { finalizeApkUpload } from '../../../../../../../lib/appstore/finalizeUpload.js';
import { createJob, completeJob, failJob } from '../../../../../../../lib/storage/finalizeJobs.js';

// POST ?uploadId= — called once every chunk has been acknowledged. This
// kicks off the concat+hash+store pipeline in the BACKGROUND and responds
// immediately, instead of making the client's HTTP request wait on the
// entire assemble-and-upload-to-storage chain. For a large APK, that chain
// (dominated by the outbound upload to whichever storage backend is
// active — GridFS/Vercel Blob/UploadThing) can run long enough to exceed a
// reverse proxy's idle timeout, producing a 504 regardless of which
// backend is configured, since the proxy times out this one request no
// matter which backend it's waiting on. The client now polls
// GET .../upload/status instead of waiting on this response body.
export async function POST(request, { params }) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
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

    const session = getSession(uploadId);
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

    createJob(uploadId);
    finalizeApkUpload({ db, app, session, chunkPaths })
      .then((result) => {
        completeJob(uploadId, result);
      })
      .catch((streamErr) => {
        let message = streamErr.message;
        if (message === 'FILE_TOO_LARGE') message = 'Assembled file is too large.';
        if (message === 'INVALID_APK_FORMAT') message = 'Invalid file format. Please upload a valid Android APK file.';
        console.error('App Store chunked upload finalize error:', streamErr);
        failJob(uploadId, message);
      })
      .finally(() => {
        deleteSession(uploadId).catch(() => {});
      });

    return NextResponse.json({ success: true, processing: true, uploadId });
  } catch (error) {
    console.error('App Store chunked upload complete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
