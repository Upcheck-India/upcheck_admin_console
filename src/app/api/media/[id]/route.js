// src/app/api/media/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import { GridFSBucket, ObjectId } from 'mongodb';

export async function GET(req, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const bucket = new GridFSBucket(db);
    
    const fileId = new ObjectId(params.id);
    const downloadStream = bucket.openDownloadStream(fileId);

    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }

    const file = await bucket.find({ _id: fileId }).next();
    
    return new Response(Buffer.concat(chunks), {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}