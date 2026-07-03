import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

// Tracks in-progress chunked App Store uploads. This is an in-memory Map,
// which is correct as long as this app runs as a single persistent Node
// process (it does — `next start`, no serverless/edge functions, no
// cluster mode). If this ever moves to a multi-instance/load-balanced
// deployment, chunk requests for one upload could land on a different
// instance than `init` created the session on — this module would need to
// move session state into MongoDB/Redis at that point.
const sessions = new Map();
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours — generous for a slow connection uploading a large APK in small chunks.

function baseDir() {
  return path.join(os.tmpdir(), 'appstore-chunked-uploads');
}

async function cleanupStale() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      await deleteSession(id);
    }
  }
}

export async function createSession({ appId, version, changelog, filename, totalSize, totalChunks, uploadedBy }) {
  await cleanupStale();
  const uploadId = crypto.randomUUID();
  const tempDir = path.join(baseDir(), uploadId);
  await fs.mkdir(tempDir, { recursive: true });
  const session = {
    uploadId,
    appId,
    version,
    changelog,
    filename,
    totalSize,
    totalChunks,
    uploadedBy,
    createdAt: Date.now(),
    receivedChunks: new Set(),
    tempDir,
  };
  sessions.set(uploadId, session);
  return session;
}

export function getSession(uploadId) {
  return sessions.get(uploadId) || null;
}

export async function deleteSession(uploadId) {
  const session = sessions.get(uploadId);
  if (!session) return;
  sessions.delete(uploadId);
  await fs.rm(session.tempDir, { recursive: true, force: true }).catch(() => {});
}

export function chunkPath(session, index) {
  return path.join(session.tempDir, `chunk_${index}.part`);
}
