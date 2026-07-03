import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../lib/auth';
import { ObjectId } from 'mongodb';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { sendPushNotification } from '../../../../../../lib/pushNotifications';
import { getActiveProvider, getProviderForVersion } from '../../../../../../lib/storage/index.js';

const VERSION_RE = /^\d{1,4}(\.\d{1,4}){1,3}(-[a-zA-Z0-9.]+)?$/;
const MAX_APK_SIZE_BYTES = 250 * 1024 * 1024; // 250MB
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

// Rejects once more than maxBytes has flowed through — a defense-in-depth
// check for when Content-Length is missing/wrong, since none of the
// storage backends enforce a size cap of their own.
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

// Validates the ZIP local-file-header magic bytes (an APK is a ZIP) on the
// first chunk(s) without buffering the whole file — this is the same check
// the old buffer-everything-first implementation did, just applied inline
// to the stream instead of to a fully-materialized ArrayBuffer.
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

// Computes a real SHA-256 of the uploaded bytes as they stream through —
// this is the one part of the "security report" that was previously
// entirely fabricated (a hardcoded "Verified Certificate Signature"
// string). We can't do real signature verification or malware scanning
// without a dedicated scanning service, so instead of pretending to, we
// report exactly what was actually checked: structural ZIP validity plus
// a checksum an admin can independently verify.
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

    // 1. Fetch app document
    const app = await db.collection('appstore_apps').findOne({ _id: new ObjectId(id) });
    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // 2. Check update rights (Admin or distributor)
    const userRole = (user.role || 'member').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'console admin' || userRole === 'console_admin';
    const isDistributor = app.distributorId === user._id.toString();

    if (!isAdmin && !isDistributor) {
      return NextResponse.json({ error: 'Forbidden: Only admins or the original publisher can upload updates' }, { status: 403 });
    }

    const versions = app.versions || [];
    const isUpdate = versions.length > 0;

    // Global kill switches: uploads gate the very first version of an app,
    // updates gate every subsequent version. Admins always retain access.
    const settings = await db.collection('appstore_settings').findOne({});
    if (!isAdmin) {
      if (!isUpdate && settings?.uploadsDisabled) {
        return NextResponse.json({ error: 'App uploads are currently disabled by an administrator' }, { status: 403 });
      }
      if (isUpdate && settings?.updatesDisabled) {
        return NextResponse.json({ error: 'App updates are currently disabled by an administrator' }, { status: 403 });
      }
    }

    // 3. Read upload metadata — sent via query params/headers rather than
    // multipart form fields. request.formData() (the old approach) forces
    // Next.js to fully buffer the entire request body — including the APK
    // itself — before any of this handler's code runs, which for a large
    // file means the origin sits idle doing nothing observable for the
    // whole upload duration and is a prime cause of gateway/proxy timeouts
    // (524s) on slower connections. Reading the body as a raw stream lets
    // bytes start flowing into storage immediately.
    const { searchParams } = new URL(request.url);
    const version = searchParams.get('version') || '';
    const changelog = decodeURIComponent(searchParams.get('changelog') || '');
    const filename = decodeURIComponent(searchParams.get('filename') || 'app-release.apk');

    if (!version.trim()) {
      return NextResponse.json({ error: 'Version is required' }, { status: 400 });
    }
    if (!VERSION_RE.test(version.trim())) {
      return NextResponse.json({ error: 'Version must look like 1.0 or 1.0.0 (numeric segments, optional -suffix)' }, { status: 400 });
    }
    if (changelog.length > 2000) {
      return NextResponse.json({ error: 'Release notes must be 2000 characters or fewer' }, { status: 400 });
    }
    if (!request.body) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_APK_SIZE_BYTES) {
      return NextResponse.json({ error: `File is too large. Maximum size is ${MAX_APK_SIZE_BYTES / (1024 * 1024)}MB` }, { status: 400 });
    }

    // Validate version uniqueness
    const versionExists = versions.some(v => v.version === version.trim());
    if (versionExists) {
      return NextResponse.json({ error: `Version ${version} already exists` }, { status: 400 });
    }

    // 4. Stream the request body straight into the active storage backend,
    // validating ZIP structure and computing a checksum inline — no
    // full-file buffering anywhere in this path (except UploadThing, which
    // buffers internally — see lib/storage/uploadthing.js).
    const provider = await getActiveProvider(db);
    const { sink, finalize, cleanup } = provider.startUpload(db, {
      filename,
      contentType: 'application/vnd.android.package-archive',
      appId: id,
      version: version.trim(),
      uploadedBy: user._id.toString(),
    });

    const sizeLimiter = new SizeLimitStream(MAX_APK_SIZE_BYTES);
    const magicCheck = new ZipMagicCheckStream();
    const hasher = new HashPassThrough();

    let storageResult;
    try {
      await pipeline(Readable.fromWeb(request.body), sizeLimiter, magicCheck, hasher, sink);
      storageResult = await finalize();
    } catch (streamErr) {
      // Clean up whatever the provider may have already written before the
      // error was raised.
      await cleanup(storageResult).catch(() => {});
      if (streamErr.message === 'FILE_TOO_LARGE') {
        return NextResponse.json({ error: `File is too large. Maximum size is ${MAX_APK_SIZE_BYTES / (1024 * 1024)}MB` }, { status: 400 });
      }
      if (streamErr.message === 'INVALID_APK_FORMAT') {
        return NextResponse.json({ error: 'Invalid file format. Please upload a valid Android APK file.' }, { status: 400 });
      }
      throw streamErr;
    }

    // 5. Security report — honest about what was actually checked. We
    // don't have a malware-scanning or APK-signature-verification service
    // wired up, so rather than fabricate a "Verified Certificate Signature"
    // result (as this route previously did unconditionally), report the
    // structural check that was really performed plus a checksum an admin
    // can independently verify against a known-good build artifact.
    const cleanAppName = app.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const packageName = `com.upcheck.internal.${cleanAppName}`;

    // 6. Add new version to metadata
    const newVersion = {
      _id: new ObjectId(),
      version: version.trim(),
      ...storageResult,
      filename,
      sizeBytes: sizeLimiter.total,
      uploadedAt: new Date(),
      changelog: (changelog || 'No release notes.').trim(),
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

    let updatedVersions = [...versions, newVersion];

    // Maintain up to 3 versions
    if (updatedVersions.length > 3) {
      // Sort oldest first
      updatedVersions.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
      // Get oldest
      const oldest = updatedVersions[0];
      await getProviderForVersion(oldest).deleteFile(db, oldest).catch(() => {});
      // Remove from array
      updatedVersions.shift();
    }

    // Sort versions so newest is at the end (or retrieve current latest)
    updatedVersions.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
    const latestVerStr = updatedVersions[updatedVersions.length - 1]?.version || version.trim();

    await db.collection('appstore_apps').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          versions: updatedVersions,
          latestVersion: latestVerStr,
          updatedAt: new Date()
        }
      }
    );

    // 7. Push notifications dispatch to all subscribers
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
            `${app.name} has been updated to version ${version}! Open App Store to download.`,
            { type: 'appstore_update', appId: id }
          ).catch(() => {});
        }
      }
    }

    return NextResponse.json({
      success: true,
      version: newVersion,
      latestVersion: latestVerStr
    });
  } catch (error) {
    console.error('App Store apps upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
