import { ObjectId } from 'mongodb';
import fs from 'fs';
import { Transform, PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { sendPushNotification } from '../pushNotifications.js';
import { getActiveProvider, getProviderForVersion } from '../storage/index.js';

export const MAX_APK_SIZE_BYTES = 250 * 1024 * 1024; // 250MB
export const VERSION_RE = /^\d{1,4}(\.\d{1,4}){1,3}(-[a-zA-Z0-9.]+)?$/;
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

class SizeLimitStream extends Transform {
  constructor(maxBytes, opts) {
    super(opts);
    this.maxBytes = maxBytes;
    this.total = 0;
  }
  _transform(chunk, _enc, cb) {
    this.total += chunk.length;
    if (this.total > this.maxBytes) {
      cb(new Error('FILE_TOO_LARGE'));
      return;
    }
    cb(null, chunk);
  }
}

class ZipMagicCheckStream extends Transform {
  constructor(opts) {
    super(opts);
    this._header = Buffer.alloc(0);
    this._checked = false;
  }
  _transform(chunk, _enc, cb) {
    if (this._checked) {
      cb(null, chunk);
      return;
    }
    this._header = this._header.length ? Buffer.concat([this._header, chunk]) : chunk;
    if (this._header.length < 4) {
      cb();
      return;
    }
    const isZip = ZIP_MAGIC.every((byte, i) => this._header[i] === byte);
    this._checked = true;
    if (!isZip) {
      cb(new Error('INVALID_APK_FORMAT'));
      return;
    }
    cb(null, this._header);
    this._header = null;
  }
  _flush(cb) {
    if (!this._checked) {
      cb(new Error('INVALID_APK_FORMAT'));
      return;
    }
    cb();
  }
}

class HashPassThrough extends Transform {
  constructor(opts) {
    super(opts);
    this._hash = crypto.createHash('sha256');
  }
  _transform(chunk, _enc, cb) {
    this._hash.update(chunk);
    cb(null, chunk);
  }
  get digest() {
    return this._hash.digest('hex');
  }
}

/** Reads chunk files 0..n-1 in order and writes them, concatenated, into a
 * single PassThrough — turns N small assembled files back into one
 * logical byte stream for the existing validate+upload pipeline. */
function concatChunkFiles(chunkPaths) {
  const out = new PassThrough();
  (async () => {
    try {
      for (const p of chunkPaths) {
        await new Promise((resolve, reject) => {
          const rs = fs.createReadStream(p);
          rs.on('error', reject);
          rs.on('end', resolve);
          rs.pipe(out, { end: false });
        });
      }
      out.end();
    } catch (err) {
      out.destroy(err);
    }
  })();
  return out;
}

/**
 * Validates and stores an assembled APK (from concatenated chunk files),
 * then records the new version on the app document — the same logic the
 * single-shot upload route used to do inline, now shared so the chunked
 * upload's "complete" step can reuse it verbatim.
 */
export async function finalizeApkUpload({ db, app, session, chunkPaths }) {
  const provider = await getActiveProvider(db);
  const { sink, finalize, cleanup } = provider.startUpload(db, {
    filename: session.filename,
    contentType: 'application/vnd.android.package-archive',
    appId: session.appId,
    version: session.version,
    uploadedBy: session.uploadedBy,
  });

  const sizeLimiter = new SizeLimitStream(MAX_APK_SIZE_BYTES);
  const magicCheck = new ZipMagicCheckStream();
  const hasher = new HashPassThrough();

  let storageResult;
  try {
    await pipeline(concatChunkFiles(chunkPaths), sizeLimiter, magicCheck, hasher, sink);
    storageResult = await finalize();
  } catch (streamErr) {
    await cleanup(storageResult).catch(() => {});
    throw streamErr;
  }

  const cleanAppName = app.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const packageName = `com.upcheck.internal.${cleanAppName}`;

  const newVersion = {
    _id: new ObjectId(),
    version: session.version,
    ...storageResult,
    filename: session.filename,
    sizeBytes: sizeLimiter.total,
    uploadedAt: new Date(),
    changelog: (session.changelog || 'No release notes.').trim(),
    securityReport: {
      packageName,
      scanType: 'structural',
      signatureStatus: 'Not verified — no code-signing check performed',
      sha256: hasher.digest,
      structurallyValidZip: true,
      isSafe: null,
      scanNotes: 'Automated check confirms this is a well-formed ZIP/APK archive only. No malware, virus, or permission-abuse scan was performed — verify the source before installing.',
      scannedAt: new Date()
    }
  };

  const versions = app.versions || [];
  let updatedVersions = [...versions, newVersion];

  if (updatedVersions.length > 3) {
    updatedVersions.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
    const oldest = updatedVersions[0];
    await getProviderForVersion(oldest).deleteFile(db, oldest).catch(() => {});
    updatedVersions.shift();
  }

  updatedVersions.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
  const latestVerStr = updatedVersions[updatedVersions.length - 1]?.version || session.version;

  await db.collection('appstore_apps').updateOne(
    { _id: app._id },
    {
      $set: {
        versions: updatedVersions,
        latestVersion: latestVerStr,
        updatedAt: new Date()
      }
    }
  );

  const subscribers = app.subscribers || [];
  if (subscribers.length > 0) {
    const subscriberObjectIds = subscribers.map(s => {
      try { return new ObjectId(s); } catch { return s; }
    });
    const subscriberUsers = await db.collection('admin_users')
      .find({ _id: { $in: subscriberObjectIds } })
      .toArray();

    for (const subUser of subscriberUsers) {
      if (subUser.expoPushToken) {
        sendPushNotification(
          subUser._id.toString(),
          '📲 App Store Update',
          `${app.name} has been updated to version ${session.version}! Open App Store to download.`,
          { type: 'appstore_update', appId: session.appId }
        ).catch(() => {});
      }
    }
  }

  return { version: newVersion, latestVersion: latestVerStr };
}
