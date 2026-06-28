// src/app/api/chat/upload-media/route.js
import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import crypto from 'crypto';
import clientPromise from '../../../../lib/mongodb';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_CHAT_TYPES = ['dm', 'team', 'group'];

async function getAuthUser(req) {
  const authHeader = req.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : req.cookies.get?.('admin_token')?.value;
  if (!token) return null;
  const client = await clientPromise;
  const db = client.db('resources');
  return await db.collection('admin_users').findOne({ sessionToken: token });
}

export async function POST(req) {
  try {
    // --- Auth ---
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- Parse multipart/form-data ---
    const formData = await req.formData();
    const file = formData.get('file');
    const chatType = formData.get('chatType');
    const chatId = formData.get('chatId');
    const clientId = formData.get('clientId'); // For cancellation tracking

    // --- Validate required fields ---
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!chatType || !ALLOWED_CHAT_TYPES.includes(chatType)) {
      return NextResponse.json(
        { error: `chatType must be one of: ${ALLOWED_CHAT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    // --- Validate MIME type ---
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // --- Validate file size ---
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds the 10MB limit' },
        { status: 400 }
      );
    }

    // --- De-duplication Check (MD5 Content Hash) ---
    const client = await clientPromise;
    const db = client.db('resources');
    const md5 = crypto.createHash('md5').update(Buffer.from(bytes)).digest('hex');

    const existingFile = await db.collection('chat_media.files').findOne({ 'metadata.md5': md5 });
    if (existingFile) {
      return NextResponse.json({
        success: true,
        mediaId: existingFile._id.toString(),
        mediaUrl: '/api/chat/media/' + existingFile._id.toString(),
      });
    }

    // --- Upload to GridFS ---
    const bucket = new GridFSBucket(db, { bucketName: 'chat_media' });

    const metadata = {
      uploadedBy: user._id.toString(),
      chatType,
      chatId,
      originalName: file.name,
      uploadedAt: new Date(),
      clientId: clientId || null, // Allow client to track and cancel this specific upload
      md5, // Save custom md5 hash for future de-duplication checks
      refs: 0, // Reference counter for safe deletion
    };

    const uploadStream = bucket.openUploadStream(file.name, {
      contentType: file.type,
      metadata,
    });

    const readable = Readable.from(Buffer.from(bytes));

    await new Promise((resolve, reject) => {
      readable.pipe(uploadStream);
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });

    const fileId = uploadStream.id;

    // Check if it was cancelled during upload
    const cancellation = await db.collection('cancelled_uploads').findOne({
      clientId,
      uploadedBy: user._id.toString()
    });

    if (cancellation) {
      await bucket.delete(fileId).catch(() => {});
      await db.collection('cancelled_uploads').deleteOne({ _id: cancellation._id });
      return NextResponse.json({ error: 'Upload was cancelled' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      mediaId: fileId.toString(),
      mediaUrl: '/api/chat/media/' + fileId.toString(),
    });
  } catch (err) {
    console.error('Chat media upload error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
