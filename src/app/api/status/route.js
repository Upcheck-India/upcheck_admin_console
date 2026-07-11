import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../lib/auth';
import { isStatusEnabled, isMusicStatusEnabled, getStatusSettings } from '../../../lib/status/settings';
import { uploadStatusMedia } from '../../../lib/status/media';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CAPTION_LENGTH = 500;
const MAX_MUSIC_FIELD_LENGTH = 500;
const MAX_CLIP_DURATION_SEC = 30;

// Music comes from the client as a JSON blob describing a result the user
// picked from /api/status/music/search — re-validate/whitelist it rather
// than trusting it verbatim, since streamUrl gets played back client-side
// by every viewer of this status.
function sanitizeMusic(raw) {
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed?.streamUrl || typeof parsed.streamUrl !== 'string' || !/^https?:\/\//.test(parsed.streamUrl)) {
    return null;
  }
  const clamp = (v) => (typeof v === 'string' ? v.slice(0, MAX_MUSIC_FIELD_LENGTH) : null);
  const durationSec = Number.isFinite(parsed.durationSec) ? Math.max(0, Math.round(parsed.durationSec)) : null;

  // Clip window (the 30s the user chose from the full track) — clamp
  // defensively regardless of what the client claims: start can't be
  // negative or past the track's own duration, and the clip can't exceed
  // 30s or run past the end of the track.
  let clipStartSec = Number.isFinite(parsed.clipStartSec) ? Math.max(0, parsed.clipStartSec) : 0;
  if (durationSec != null) clipStartSec = Math.min(clipStartSec, durationSec);
  let clipDurationSec = Number.isFinite(parsed.clipDurationSec) && parsed.clipDurationSec > 0
    ? Math.min(MAX_CLIP_DURATION_SEC, parsed.clipDurationSec)
    : MAX_CLIP_DURATION_SEC;
  if (durationSec != null) clipDurationSec = Math.min(clipDurationSec, durationSec - clipStartSec);
  clipDurationSec = Math.max(0, clipDurationSec);

  return {
    songId: clamp(parsed.id) || null,
    title: clamp(parsed.title) || 'Unknown title',
    artist: clamp(parsed.artist) || 'Unknown artist',
    album: clamp(parsed.album),
    thumbnail: (typeof parsed.thumbnail === 'string' && /^https?:\/\//.test(parsed.thumbnail)) ? parsed.thumbnail : null,
    durationSec,
    clipStartSec,
    clipDurationSec,
    streamUrl: clamp(parsed.streamUrl),
  };
}

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
    const hasFile = file && typeof file !== 'string';

    const rawMusic = formData.get('music');
    let music = null;
    if (rawMusic) {
      if (!(await isMusicStatusEnabled(db))) {
        return NextResponse.json({ error: 'Music in status is currently disabled' }, { status: 403 });
      }
      music = sanitizeMusic(rawMusic.toString());
      if (!music) {
        return NextResponse.json({ error: 'Invalid music selection' }, { status: 400 });
      }
    }

    if (!hasFile && !music) {
      return NextResponse.json({ error: 'A photo or a song is required' }, { status: 400 });
    }

    let uploaded = null;
    if (hasFile) {
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
      const buffer = Buffer.from(bytes);
      uploaded = await uploadStatusMedia(db, buffer, { contentType: file.type, userId: user._id.toString() });
    }

    const settings = await getStatusSettings(db);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + settings.retentionHours * 60 * 60 * 1000);

    // Three shapes: an uploaded photo (optionally with music on top), a
    // standalone music status using the song's own album art as the
    // background (no upload of ours — we just reference JioSaavn's CDN
    // image directly), or a standalone music status with no usable art at
    // all, which the client renders as a music-icon card instead of an
    // Image.
    const mediaUrl = uploaded ? uploaded.mediaUrl : (music?.thumbnail || null);
    const mediaType = mediaUrl ? 'image' : 'music';

    const statusDoc = {
      _id: new ObjectId(),
      userId: user._id.toString(),
      mediaType,
      mediaUrl,
      provider: uploaded ? uploaded.provider : (mediaUrl ? 'external' : null),
      ...(uploaded?.cloudinaryPublicId ? { cloudinaryPublicId: uploaded.cloudinaryPublicId } : {}),
      ...(uploaded?.gridfsId ? { gridfsId: uploaded.gridfsId } : {}),
      ...(music ? { music } : {}),
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
