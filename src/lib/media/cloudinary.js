import { v2 as cloudinary } from 'cloudinary';

let configured = false;

// Cloudinary is only actually usable if all three credentials are present —
// an admin can flip the DB toggle on before/without setting the env vars
// (e.g. mid-rollout), so every call site must treat "enabled but
// unconfigured" as unavailable rather than throwing.
export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function ensureConfigured() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

/**
 * Uploads a buffer to Cloudinary. Returns null (never throws) on failure so
 * callers can gracefully fall back to GridFS instead of failing the request.
 *
 * @param {Buffer} buffer
 * @param {{ folder?: string, publicId?: string, resourceType?: 'image'|'video'|'auto' }} options
 */
export async function uploadBufferToCloudinary(buffer, options = {}) {
  if (!isCloudinaryConfigured()) {
    console.warn('[Cloudinary] Upload skipped: credentials not configured');
    return null;
  }
  ensureConfigured();

  try {
    return await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.publicId,
          resource_type: options.resourceType || 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });
  } catch (err) {
    console.error('[Cloudinary] Upload failed, caller should fall back to GridFS:', err);
    return null;
  }
}

/**
 * Deletes an asset from Cloudinary by public ID. Best-effort — logs and
 * swallows errors, since a failed remote delete should never block a
 * message/avatar delete that has already happened in the app's own DB.
 */
export async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!publicId || !isCloudinaryConfigured()) return;
  ensureConfigured();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('[Cloudinary] Delete failed for', publicId, err);
  }
}

// f_auto (best format for the requesting client) + q_auto (best
// quality/compression tradeoff) — the same optimization every asset should
// get when served, not just at upload time.
export function getOptimizedUrl(publicId, resourceType = 'image') {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    fetch_format: 'auto',
    quality: 'auto',
    secure: true,
  });
}
