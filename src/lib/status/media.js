import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { isCloudinaryActive } from '../media/settings.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../media/cloudinary.js';

const GRIDFS_BUCKET = 'status_media';

// Mirrors the avatar route's single-asset upload pattern (no dedup/ref-
// counting needed — every status update is its own distinct asset with its
// own 24h lifecycle, never shared/forwarded like chat media is).
export async function uploadStatusMedia(db, buffer, { contentType, userId }) {
  if (await isCloudinaryActive(db, 'status')) {
    const result = await uploadBufferToCloudinary(buffer, { folder: `status/${userId}` });
    if (result) {
      return { provider: 'cloudinary', mediaUrl: result.secure_url, cloudinaryPublicId: result.public_id };
    }
    // Falls through to GridFS if the Cloudinary upload failed.
  }

  const bucket = new GridFSBucket(db, { bucketName: GRIDFS_BUCKET });
  const filename = `status_${userId}_${Date.now()}.jpg`;
  const uploadStream = bucket.openUploadStream(filename, {
    contentType,
    metadata: { uploadedBy: userId, uploadedAt: new Date() },
  });
  await new Promise((resolve, reject) => {
    Readable.from(buffer).pipe(uploadStream);
    uploadStream.on('finish', resolve);
    uploadStream.on('error', reject);
  });

  return { provider: 'gridfs', mediaUrl: `/api/status/media/${uploadStream.id.toString()}`, gridfsId: uploadStream.id };
}

export async function deleteStatusMedia(db, status) {
  if (!status) return;
  if (status.provider === 'cloudinary' && status.cloudinaryPublicId) {
    await deleteFromCloudinary(status.cloudinaryPublicId);
    return;
  }
  if (status.gridfsId) {
    const id = typeof status.gridfsId === 'string' ? new ObjectId(status.gridfsId) : status.gridfsId;
    await new GridFSBucket(db, { bucketName: GRIDFS_BUCKET }).delete(id).catch((err) => {
      console.error('GridFS status media deletion failed:', err);
    });
  }
}

export { GRIDFS_BUCKET };
