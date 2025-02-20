// src/app/api/documents/upload/route.js
import { NextResponse } from 'next/server';
import { GridFSBucket } from 'mongodb';
import clientPromise from '@/lib/mongodb';

export async function POST(req) {
  const client = await clientPromise;
  const db = client.db('resources');
  const bucket = new GridFSBucket(db);

  const file = await req.formData().get('file');
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
  }

  try {
    const uploadStream = bucket.openUploadStream(file.name, {
      metadata: {
        uploadedBy: 'Console admin', // Replace with actual user info
        department: 'Development' // Replace with actual department
      }
    });

    await new Promise((resolve, reject) => {
      file.stream().pipe(uploadStream).on('finish', resolve).on('error', reject);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}