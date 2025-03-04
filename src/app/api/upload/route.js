import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";
import { GridFSBucket } from 'mongodb';

export async function POST(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const bucket = new GridFSBucket(db);
   
    const formData = await req.formData();
    
    // Get basic metadata from form
    const name = formData.get('name');
    const category = formData.get('category') || 'documents';
    const description = formData.get('description') || '';
    const isDocumentationResource = formData.get('isDocumentationResource') === 'true';
    
    // Parse storage options and alternative links
    let storageOptions = ['server'];
    let alternativeLinks = {};
    
    try {
      if (formData.has('storageOptions')) {
        storageOptions = JSON.parse(formData.get('storageOptions'));
      }
      
      if (formData.has('alternativeLinks')) {
        alternativeLinks = JSON.parse(formData.get('alternativeLinks'));
      }
    } catch (parseError) {
      console.error('Error parsing JSON data:', parseError);
      return NextResponse.json({ error: "Invalid format for storage options" }, { status: 400 });
    }
    
    // Validate required data
    if (!name) {
      return NextResponse.json({ error: "Resource name is required" }, { status: 400 });
    }
    
    // Check if at least one storage option is selected
    if (storageOptions.length === 0) {
      return NextResponse.json({ error: "At least one storage option is required" }, { status: 400 });
    }
    
    // If server storage is selected, ensure we have a file
    const file = formData.get('file');
    let fileId = null;
    let fileUrl = null;
    
    if (storageOptions.includes('server')) {
      if (!file) {
        return NextResponse.json({ error: "No file provided for server storage" }, { status: 400 });
      }
      
      // Create file buffer and upload to GridFS
      const buffer = Buffer.from(await file.arrayBuffer());
      
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
      
      fileId = uploadStream.id;
      fileUrl = `/api/media/${fileId}`;
    }
    
    // Filter alternative links to only include selected options
    const selectedAlternativeLinks = {};
    for (const option of storageOptions) {
      if (option !== 'server' && alternativeLinks[option]) {
        selectedAlternativeLinks[option] = alternativeLinks[option];
      }
    }
    
    // Prepare resource data
    const resourceData = {
      name,
      category,
      description,
      storageOptions,
      downloads: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Add file-specific data if server storage is used
    if (fileId) {
      resourceData.fileId = fileId;
      resourceData.fileUrl = fileUrl;
      resourceData.originalName = file.name;
      resourceData.mimeType = file.type;
      resourceData.fileSize = formatFileSize(file.size);
      resourceData.fileSizeBytes = file.size;
    }
    
    // Add alternative links if any
    if (Object.keys(selectedAlternativeLinks).length > 0) {
      resourceData.alternativeLinks = selectedAlternativeLinks;
    }
    
    // Save metadata to the resources collection
    if (isDocumentationResource) {
      await db.collection('resources').insertOne(resourceData);
    }
    
    return NextResponse.json({
      success: true,
      fileId,
      fileUrl,
      storageOptions,
      alternativeLinks: selectedAlternativeLinks
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