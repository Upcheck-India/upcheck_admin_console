import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { GRIDFS_BUCKET } from '../../../../../lib/status/media';

// Only ever reached for GridFS-backed status media — Cloudinary-backed
// updates store their absolute secure_url directly as mediaUrl and never
// route through this endpoint at all.
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid media ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const bucket = new GridFSBucket(db, { bucketName: GRIDFS_BUCKET });

    const files = await bucket.find({ _id: new ObjectId(id) }).toArray();
    if (!files.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const downloadStream = bucket.openDownloadStream(new ObjectId(id));
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }

    return new Response(Buffer.concat(chunks), {
      headers: {
        'Content-Type': files[0].contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('Status media serve error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
