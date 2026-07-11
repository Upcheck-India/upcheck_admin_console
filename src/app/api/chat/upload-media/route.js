// src/app/api/chat/upload-media/route.js
import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import crypto from 'crypto';
import sharp from 'sharp';
import clientPromise from '../../../../lib/mongodb';
import { isCloudinaryActive } from '../../../../lib/media/settings';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../../../../lib/media/cloudinary';
import { deleteChatMedia } from '../../../../lib/media/chatMedia';

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

    // --- Optional client-side crop, applied server-side (the client sends
    // normalized 0-1 fractions of the ORIGINAL image's natural dimensions,
    // computed by the crop UI; no image-manipulation native module is
    // installed in the app, so cropping happens here instead — the client
    // stays pure JS/OTA-safe). Best-effort: any failure here falls back to
    // the uncropped original rather than failing the whole upload.
    let buffer = Buffer.from(bytes);
    const cropX = parseFloat(formData.get('cropX'));
    const cropY = parseFloat(formData.get('cropY'));
    const cropWidth = parseFloat(formData.get('cropWidth'));
    const cropHeight = parseFloat(formData.get('cropHeight'));
    const hasCrop = [cropX, cropY, cropWidth, cropHeight].every(
      (v) => Number.isFinite(v) && v >= 0 && v <= 1
    ) && cropWidth > 0 && cropHeight > 0 && cropX + cropWidth <= 1.0001 && cropY + cropHeight <= 1.0001;

    if (hasCrop) {
      try {
        const isAnimatable = file.type === 'image/gif' || file.type === 'image/webp';
        // .rotate() with no args auto-orients per the EXIF Orientation tag
        // and strips it afterwards. Without this, sharp's metadata()/extract()
        // use the raw encoded (pre-rotation) dimensions while the client's
        // Image.getSize() reports the already-rotated display dimensions —
        // for portrait phone photos (very common) that's a width/height swap
        // between what the crop UI measured and what the server crops,
        // silently cropping the wrong region.
        const pipeline = sharp(buffer, isAnimatable ? { animated: true } : undefined).rotate();
        const meta = await pipeline.metadata();
        const naturalWidth = meta.width || 0;
        const naturalHeight = meta.pageHeight || meta.height || 0;

        if (naturalWidth > 0 && naturalHeight > 0) {
          const left = Math.max(0, Math.round(cropX * naturalWidth));
          const top = Math.max(0, Math.round(cropY * naturalHeight));
          const width = Math.max(1, Math.min(naturalWidth - left, Math.round(cropWidth * naturalWidth)));
          const height = Math.max(1, Math.min(naturalHeight - top, Math.round(cropHeight * naturalHeight)));

          buffer = await pipeline.extract({ left, top, width, height }).toBuffer();
        }
      } catch (cropErr) {
        console.error('Chat media crop failed, uploading uncropped:', cropErr);
      }
    }

    // --- De-duplication Check (MD5 Content Hash) ---
    const client = await clientPromise;
    const db = client.db('resources');
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');

    const existingFile = await db.collection('chat_media.files').findOne({ 'metadata.md5': md5 });
    if (existingFile) {
      return NextResponse.json({
        success: true,
        mediaId: existingFile._id.toString(),
        mediaUrl: '/api/chat/media/' + existingFile._id.toString(),
      });
    }

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

    // Every downstream consumer (dedup lookup above, ref-counting in
    // chat/send + team-chat/messages + group-chats/messages, cancel-upload,
    // cleanup-media, and the 3 message-delete routes) only ever cares about
    // a `chat_media.files` document by _id and its `metadata` — it doesn't
    // matter whether GridFS itself created that document (with matching
    // chunks) or whether we inserted a Cloudinary-backed one by hand here,
    // as long as the shape matches. This keeps the mediaUrl contract
    // (`/api/chat/media/:id`) and every other route completely unchanged.
    let fileId;
    let usedCloudinary = false;

    if (await isCloudinaryActive(db, 'chatMedia')) {
      const result = await uploadBufferToCloudinary(buffer, {
        folder: `chat_media/${chatType}/${chatId}`,
      });
      if (result) {
        const candidateId = new ObjectId();
        try {
          await db.collection('chat_media.files').insertOne({
            _id: candidateId,
            filename: file.name,
            contentType: file.type,
            length: result.bytes,
            uploadDate: new Date(),
            metadata: {
              ...metadata,
              provider: 'cloudinary',
              cloudinaryPublicId: result.public_id,
              cloudinaryUrl: result.secure_url,
            },
          });
          fileId = candidateId;
          usedCloudinary = true;
        } catch (metaErr) {
          // The asset made it to Cloudinary but we couldn't record it —
          // without a DB row nothing (dedup, ref-counting, cleanup-media)
          // will ever know it exists, so it would sit there forever as an
          // invisible orphan. Delete it immediately instead of falling
          // through and leaking it.
          console.error('Failed to persist Cloudinary chat media metadata, deleting orphaned asset:', metaErr);
          await deleteFromCloudinary(result.public_id);
        }
      }
      // Falls through to GridFS below if the Cloudinary upload failed.
    }

    if (!usedCloudinary) {
      const bucket = new GridFSBucket(db, { bucketName: 'chat_media' });
      const uploadStream = bucket.openUploadStream(file.name, {
        contentType: file.type,
        metadata,
      });

      const readable = Readable.from(buffer);
      await new Promise((resolve, reject) => {
        readable.pipe(uploadStream);
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
      });

      fileId = uploadStream.id;
    }

    // Check if it was cancelled during upload
    const cancellation = await db.collection('cancelled_uploads').findOne({
      clientId,
      uploadedBy: user._id.toString()
    });

    if (cancellation) {
      await deleteChatMedia(db, fileId).catch(() => {});
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
