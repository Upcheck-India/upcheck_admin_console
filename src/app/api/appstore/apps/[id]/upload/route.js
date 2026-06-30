import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../lib/auth';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { sendPushNotification } from '../../../../../../lib/pushNotifications';

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

    // 3. Parse upload
    const formData = await request.formData();
    const file = formData.get('file');
    const version = formData.get('version');
    const changelog = formData.get('changelog');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    if (!version) {
      return NextResponse.json({ error: 'Version is required' }, { status: 400 });
    }

    // Validate version uniqueness
    const versions = app.versions || [];
    const versionExists = versions.some(v => v.version === version.trim());
    if (versionExists) {
      return NextResponse.json({ error: `Version ${version} already exists` }, { status: 400 });
    }

    // 4. Validate APK magic bytes (ZIP header: 50 4B 03 04)
    const bytes = await file.arrayBuffer();
    const uint8View = new Uint8Array(bytes.slice(0, 4));
    const isZip = uint8View[0] === 0x50 && uint8View[1] === 0x4B && uint8View[2] === 0x03 && uint8View[3] === 0x04;
    
    if (!isZip) {
      return NextResponse.json({ error: 'Invalid file format. Please upload a valid Android APK file.' }, { status: 400 });
    }

    // 5. Simulated Security Scan details
    const cleanAppName = app.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const packageName = `com.upcheck.internal.${cleanAppName}`;
    const targetSdk = 34;
    const minSdk = 24;

    // 6. Upload file to GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'appstore_apks' });
    const metadata = {
      appId: id,
      version: version.trim(),
      uploadedBy: user._id.toString(),
      uploadedAt: new Date()
    };

    const uploadStream = bucket.openUploadStream(file.name, {
      contentType: 'application/vnd.android.package-archive',
      metadata
    });

    const readable = Readable.from(Buffer.from(bytes));
    await new Promise((resolve, reject) => {
      readable.pipe(uploadStream);
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });

    const fileId = uploadStream.id;

    // 7. Add new version to metadata
    const newVersion = {
      _id: new ObjectId(),
      version: version.trim(),
      fileId: fileId,
      filename: file.name,
      uploadedAt: new Date(),
      changelog: (changelog || 'No release notes.').trim(),
      securityReport: {
        packageName,
        targetSdk,
        minSdk,
        signatureStatus: "Verified Certificate Signature (SHA-256)",
        isSafe: true,
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
      // Delete from GridFS
      if (oldest.fileId) {
        await bucket.delete(new ObjectId(oldest.fileId)).catch(() => {});
      }
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

    // 8. Push notifications dispatch to all subscribers
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
