// src/app/api/media/[id]/route.js
{/*}
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import { GridFSBucket, ObjectId } from 'mongodb';

export async function GET(req, context) {
  try {
    const { params } = context;
    const id = await params.id;

    const client = await clientPromise;
    const db = client.db("resources");
    const bucket = new GridFSBucket(db);
    
    const fileId = new ObjectId(id);
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
{*/}

// src/app/api/media/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

export async function GET(req, { params }) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const bucket = new GridFSBucket(db);
    
    // Try to find the file in GridFS
    const filesCursor = bucket.find({ _id: new ObjectId(id) });
    const files = await filesCursor.toArray();
    
    if (!files.length) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    const file = files[0];
    
    // Check if this is a documentation resource
    if (file.metadata?.isDocumentationResource) {
      // Update download count
      await db.collection('resources').updateOne(
        { fileId: new ObjectId(id) },
        { $inc: { downloads: 1 } }
      );
    }
    
    // Download the file
    const chunks = [];
    const downloadStream = bucket.openDownloadStream(new ObjectId(id));
    
    await new Promise((resolve, reject) => {
      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      downloadStream.on('error', (error) => {
        reject(error);
      });
      
      downloadStream.on('end', () => {
        resolve();
      });
    });
    
    const fileBuffer = Buffer.concat(chunks);
    
    // Set appropriate headers for the response
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${file.filename}"`);
    headers.set('Content-Type', file.contentType || 'application/octet-stream');
    headers.set('Content-Length', fileBuffer.length.toString());
    
    return new NextResponse(fileBuffer, { 
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}