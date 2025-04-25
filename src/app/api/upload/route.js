import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";
import { GridFSBucket } from 'mongodb';

export async function POST(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const bucket = new GridFSBucket(db);
    
    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    const uploadStream = bucket.openUploadStream(file.name, {
      contentType: file.type,
      metadata: {
        uploadedAt: new Date(),
        type: 'thumbnail'
      }
    });
    
    await new Promise((resolve, reject) => {
      uploadStream.end(buffer, (error) => {
        if (error) reject(error);
        resolve();
      });
    });
    
    const fileId = uploadStream.id;
    const fileUrl = `/api/media/${fileId}`;
    
    return NextResponse.json({
      success: true,
      fileUrl
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}