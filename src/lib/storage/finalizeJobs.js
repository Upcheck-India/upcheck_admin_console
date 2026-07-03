// Tracks the background concat+hash+store step that runs after all chunks
// of an App Store upload have been received. Keyed by uploadId (reusing
// the chunked-upload session id, since it's already unique per upload and
// the client already has it). In-memory Map — same single-process
// assumption as uploadSessions.js.
const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes — plenty for a client to finish polling

function cleanupStale() {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export function createJob(uploadId) {
  cleanupStale();
  jobs.set(uploadId, { status: 'processing', createdAt: Date.now() });
}

export function getJob(uploadId) {
  return jobs.get(uploadId) || null;
}

export function completeJob(uploadId, result) {
  const job = jobs.get(uploadId);
  if (!job) return;
  job.status = 'complete';
  job.result = result;
}

export function failJob(uploadId, error) {
  const job = jobs.get(uploadId);
  if (!job) return;
  job.status = 'error';
  job.error = error;
}
