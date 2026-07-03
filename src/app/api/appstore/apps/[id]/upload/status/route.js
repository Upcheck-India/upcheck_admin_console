import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../../lib/auth';
import { getJob } from '../../../../../../../lib/storage/finalizeJobs.js';

// GET ?uploadId= — polled by the client after /upload/complete kicks off
// finalization in the background, since that step (assembling the file and
// pushing it to storage) can take too long to hold open a single request
// through a reverse proxy for a large APK.
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');
    if (!uploadId) {
      return NextResponse.json({ error: 'uploadId is required' }, { status: 400 });
    }

    const job = getJob(uploadId);
    if (!job) {
      return NextResponse.json({ error: 'Unknown or expired finalize job' }, { status: 404 });
    }

    if (job.status === 'error') {
      return NextResponse.json({ status: 'error', error: job.error });
    }
    if (job.status === 'complete') {
      return NextResponse.json({ status: 'complete', ...job.result });
    }
    return NextResponse.json({ status: 'processing' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
