import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';

export async function GET(request, { params }) {
  try {
    const { messageId, index } = params;
    const url = new URL(request.url);
    const download = url.searchParams.get('download') === '1';

    if (!messageId || typeof index === 'undefined') {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const doc = await db.collection('email_attachments').findOne({ messageId, index: parseInt(index, 10) });
    if (!doc) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', doc.contentType || 'application/octet-stream');
    headers.set(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.filename || 'attachment')}"`
    );
    headers.set('Content-Length', String(doc.length || (doc.data?.buffer?.length ?? 0)));

    const body = doc.data?.buffer ? Buffer.from(doc.data.buffer) : Buffer.from([]);
    return new NextResponse(body, { status: 200, headers });
  } catch (err) {
    console.error('Attachment error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
