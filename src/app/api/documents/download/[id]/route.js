// src/app/api/documents/download/[id]/route.js
import { NextResponse } from 'next/server';
import { GridFSBucket } from 'mongodb';
import clientPromise from '@/lib/mongodb';

export async function GET(req, { params }) {
  const fileId = params.id;
  const client = await clientPromise;
  const db = client.db('resources');
  const bucket = new GridFSBucket(db);

  try {
    const file = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
    if (file.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));
    const headers = {
      'Content-Type': file[0].contentType,
      'Content-Disposition': `attachment; filename="${file[0].filename}"`,
    };

    return new NextResponse(downloadStream, { headers });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
  }
}