// src/app/api/chat/media/[id]/route.js
import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';

export async function GET(req, { params }) {
  try {
    const { id } = params;

    // --- Validate ObjectId ---
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid media ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const bucket = new GridFSBucket(db, { bucketName: 'chat_media' });

    // --- Find file metadata ---
    const files = await bucket.find({ _id: new ObjectId(id) }).toArray();
    if (!files.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const file = files[0];

    // --- Stream file content ---
    const downloadStream = bucket.openDownloadStream(new ObjectId(id));
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new Response(buffer, {
      headers: {
        'Content-Type': file.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (err) {
    console.error('Chat media serve error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
