import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../lib/auth';
import { isStatusEnabled, getStatusSettings } from '../../../lib/status/settings';
import { uploadStatusMedia } from '../../../lib/status/media';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CAPTION_LENGTH = 500;

export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, db } = auth;

    if (!(await isStatusEnabled(db))) {
      return NextResponse.json({ error: 'Status updates are currently disabled' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const caption = (formData.get('caption') || '').toString().slice(0, MAX_CAPTION_LENGTH);

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
      return NextResponse.json({ error: 'File size exceeds the 10MB limit' }, { status: 400 });
    }

    const settings = await getStatusSettings(db);
    const buffer = Buffer.from(bytes);
    const uploaded = await uploadStatusMedia(db, buffer, { contentType: file.type, userId: user._id.toString() });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + settings.retentionHours * 60 * 60 * 1000);

    const statusDoc = {
      _id: new ObjectId(),
      userId: user._id.toString(),
      mediaType: 'image',
      mediaUrl: uploaded.mediaUrl,
      provider: uploaded.provider,
      ...(uploaded.cloudinaryPublicId ? { cloudinaryPublicId: uploaded.cloudinaryPublicId } : {}),
      ...(uploaded.gridfsId ? { gridfsId: uploaded.gridfsId } : {}),
      caption,
      createdAt: now,
      expiresAt,
      deletedAt: null,
    };

    await db.collection('status_updates').insertOne(statusDoc);

    return NextResponse.json({
      success: true,
      status: { ...statusDoc, _id: statusDoc._id.toString(), gridfsId: undefined },
    });
  } catch (err) {
    console.error('Status create error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
