import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../../lib/auth';
import { ObjectId } from 'mongodb';
import fs from 'fs/promises';
import { getSession, chunkPath } from '../../../../../../../lib/storage/uploadSessions.js';

const MAX_CHUNK_BYTES = 16 * 1024 * 1024; // safety cap — client chunks are expected to be ~8MB

// POST ?uploadId=&chunkIndex= — raw binary body is this chunk's bytes.
// Writing each chunk to its own small temp file (rather than trying to
// keep one long-lived write stream open across independent HTTP requests)
// means a dropped connection only costs you one chunk's retry, and chunks
// can even arrive out of order or be safely re-sent (idempotent by index).
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

    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');
    const chunkIndex = parseInt(searchParams.get('chunkIndex') || '', 10);

    if (!uploadId || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json({ error: 'uploadId and chunkIndex are required' }, { status: 400 });
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

    if (chunkIndex >= session.totalChunks) {
      return NextResponse.json({ error: 'chunkIndex out of range for this upload' }, { status: 400 });
    }

    if (!request.body) {
      return NextResponse.json({ error: 'Chunk body is required' }, { status: 400 });
    }
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_CHUNK_BYTES) {
      return NextResponse.json({ error: `Chunk too large. Maximum is ${MAX_CHUNK_BYTES / (1024 * 1024)}MB per chunk` }, { status: 400 });
    }

    const buffer = Buffer.from(await request.arrayBuffer());
    if (buffer.length > MAX_CHUNK_BYTES) {
      return NextResponse.json({ error: `Chunk too large. Maximum is ${MAX_CHUNK_BYTES / (1024 * 1024)}MB per chunk` }, { status: 400 });
    }

    await fs.writeFile(chunkPath(session, chunkIndex), buffer);
    session.receivedChunks.add(chunkIndex);

    return NextResponse.json({ success: true, received: chunkIndex, totalReceived: session.receivedChunks.size, totalChunks: session.totalChunks });
  } catch (error) {
    console.error('App Store chunked upload chunk error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
