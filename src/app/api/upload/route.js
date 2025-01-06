// src/app/api/upload/route.js
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadStream = bucket.openUploadStream(file.name, {
      contentType: file.type,
    });

    await new Promise((resolve, reject) => {
      uploadStream.end(buffer, (error) => {
        if (error) reject(error);
        resolve();
      });
    });

    const fileId = uploadStream.id;
    const fileUrl = `/api/media/${fileId}`;

    return NextResponse.json({ fileUrl });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}