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

    // Get additional metadata from form if it exists
    const name = formData.get('name') || file.name;
    const category = formData.get('category') || 'documents';
    const description = formData.get('description') || '';
    const isDocumentationResource = formData.get('isDocumentationResource') === 'true';

    // Create file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Upload file to GridFS
    const uploadStream = bucket.openUploadStream(file.name, {
      contentType: file.type,
      metadata: {
        originalName: file.name,
        category,
        description,
        isDocumentationResource,
        fileSize: formatFileSize(file.size),
        fileSizeBytes: file.size,
        createdAt: new Date(),
        updatedAt: new Date()
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

    // If this is a documentation resource, save additional metadata to the resources collection
    if (isDocumentationResource) {
      await db.collection('resources').insertOne({
        name,
        originalName: file.name,
        mimeType: file.type,
        fileSize: formatFileSize(file.size),
        fileSizeBytes: file.size,
        category,
        description,
        downloads: 0,
        fileId: fileId,
        fileUrl: fileUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return NextResponse.json({ 
      fileId,
      fileUrl,
      success: true
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  else return (bytes / 1073741824).toFixed(1) + ' GB';
}