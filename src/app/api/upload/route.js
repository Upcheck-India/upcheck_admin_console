import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";
import { GridFSBucket } from 'mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const bucket = new GridFSBucket(db);
    
    const formData = await req.formData();
    const file = formData.get('file');
    const name = formData.get('name');
    const category = formData.get('category') || 'documents';
    const description = formData.get('description') || '';
    const isDocumentationResource = formData.get('isDocumentationResource') === 'true';
    const projectId = formData.get('projectId');
    const isPasswordProtected = formData.get('isPasswordProtected') === 'true';
    const password = formData.get('password') || '';
    const storageOptions = JSON.parse(formData.get('storageOptions') || '[]');
    const alternativeLinks = JSON.parse(formData.get('alternativeLinks') || '{}');
    const uploadedBy = formData.get('uploadedBy') ? JSON.parse(formData.get('uploadedBy')) : null;
    
    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let fileId = null;
    let fileUrl = null;
    let fileSize = 0;
    let mimeType = '';

    // Handle file upload if server storage is selected
    if (storageOptions.includes('server') && file) {
      // 50MB limit for document files
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: "File size exceeds 50MB limit" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      fileSize = file.size;
      mimeType = file.type;
      
      const uploadStream = bucket.openUploadStream(file.name, {
        contentType: file.type,
        metadata: {
          uploadedAt: new Date(),
          originalName: file.name,
          isDocumentationResource: isDocumentationResource,
          name: name,
          description: description,
          category: category,
          fileSize: file.size
        }
      });
      
      await new Promise((resolve, reject) => {
        uploadStream.end(buffer, (error) => {
          if (error) reject(error);
          resolve();
        });
      });
      
      fileId = uploadStream.id;
      fileUrl = `/api/media/${fileId}`;
    }

    // Create resource document
    const resourceData = {
      name,
      category,
      description,
      storageOptions,
      alternativeLinks,
      downloads: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDocumentationResource,
      ...(uploadedBy && { uploadedBy }), // Add uploadedBy information
      isPasswordProtected: isPasswordProtected && password.length > 0,
      ...(password && { passwordHash: password }), // In production, hash the password properly
      ...(fileId && { fileId }),
      ...(projectId && { projectId: new ObjectId(projectId) }),
      ...(mimeType && { mimeType }),
      ...(fileSize > 0 && { fileSize })
    };

    // Save to resources collection
    const result = await db.collection('resources').insertOne(resourceData);
    
    return NextResponse.json({
      success: true,
      fileUrl,
      resourceId: result.insertedId
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to upload file',
      success: false 
    }, { status: 500 });
  }
}