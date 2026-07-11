import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import crypto from 'crypto';
import clientPromise from '../../../../../lib/mongodb';
import { isCloudinaryActive } from '../../../../../lib/media/settings';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../../../../../lib/media/cloudinary';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

async function getAuth(req) {
  const authHeader = req.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : req.cookies.get?.('admin_token')?.value;
  if (!token) return null;
  const client = await clientPromise;
  const db = client.db('resources');
  const user = await db.collection('admin_users').findOne({ sessionToken: token });
  return user ? { user, db } : null;
}

// A Cloudinary-backed avatar is stored as its full secure_url (an absolute
// http(s) URL); a GridFS-backed one is the app's own relative
// `/api/media/:id` path. The mobile client's getFullMediaUrl() already
// passes absolute URLs through unchanged, so no app-side change is needed
// for either case.
async function deleteOldAvatar(db, existingAvatar) {
  if (!existingAvatar || typeof existingAvatar !== 'string') return;

  if (existingAvatar.startsWith('http://') || existingAvatar.startsWith('https://')) {
    const match = existingAvatar.match(/\/([^/]+)\.[a-zA-Z0-9]+(?:\?.*)?$/);
    const publicId = match ? `avatars/${match[1]}` : null;
    if (publicId) await deleteFromCloudinary(publicId);
    return;
  }

  const parts = existingAvatar.split('/');
  const oldIdStr = parts[parts.length - 1];
  if (ObjectId.isValid(oldIdStr)) {
    const bucket = new GridFSBucket(db); // Default bucket name: 'fs'
    try {
      await bucket.delete(new ObjectId(oldIdStr));
      console.log(`Deleted old avatar ${oldIdStr} from GridFS`);
    } catch (err) {
      console.warn(`Could not delete old avatar ${oldIdStr} (might not exist in GridFS):`, err.message);
    }
  }
}

// POST - Upload and set profile avatar
export async function POST(req) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, db } = auth;

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds the 5MB limit' },
        { status: 400 }
      );
    }

    // Delete old custom avatar if it exists
    await deleteOldAvatar(db, user.avatar);

    const buffer = Buffer.from(bytes);
    let avatarUrl = null;
    let uploadedCloudinaryPublicId = null;

    if (await isCloudinaryActive(db, 'avatar')) {
      const publicId = `${user._id.toString()}_${crypto.randomBytes(4).toString('hex')}`;
      const result = await uploadBufferToCloudinary(buffer, { folder: 'avatars', publicId });
      if (result) {
        avatarUrl = result.secure_url;
        uploadedCloudinaryPublicId = result.public_id;
      }
      // Falls through to GridFS below if Cloudinary upload failed for any
      // reason (misconfigured, network error, etc) — an avatar upload
      // should never fail outright just because Cloudinary is unavailable.
    }

    if (!avatarUrl) {
      // Upload to default GridFS bucket (bucketName defaults to 'fs')
      const bucket = new GridFSBucket(db);
      const filename = `avatar_${user._id.toString()}_${Date.now()}.jpg`;
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: file.type,
        metadata: {
          uploadedBy: user._id.toString(),
          isAvatar: true,
          uploadedAt: new Date()
        }
      });

      const readable = Readable.from(buffer);
      await new Promise((resolve, reject) => {
        readable.pipe(uploadStream);
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
      });

      avatarUrl = `/api/media/${uploadStream.id.toString()}`;
    }

    // Update avatar field in user document
    try {
      await db.collection('admin_users').updateOne(
        { _id: user._id },
        { $set: { avatar: avatarUrl, updatedAt: new Date() } }
      );
    } catch (dbErr) {
      // The asset already made it to Cloudinary (or GridFS) but the user
      // doc never got updated to point at it — nothing references it, so
      // it would otherwise sit there as an invisible orphan forever.
      if (uploadedCloudinaryPublicId) {
        await deleteFromCloudinary(uploadedCloudinaryPublicId);
      } else if (avatarUrl?.startsWith('/api/media/')) {
        const orphanId = avatarUrl.split('/').pop();
        if (ObjectId.isValid(orphanId)) {
          await new GridFSBucket(db).delete(new ObjectId(orphanId)).catch(() => {});
        }
      }
      throw dbErr;
    }

    return NextResponse.json({ success: true, avatar: avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE - Remove avatar
export async function DELETE(req) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, db } = auth;

    // Delete existing avatar from GridFS
    await deleteOldAvatar(db, user.avatar);

    // Reset user avatar field
    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { $set: { avatar: '', updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Avatar deletion error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
