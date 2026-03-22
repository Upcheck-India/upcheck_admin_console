import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import clientPromise from '../../../../lib/mongodb';

export async function POST(req) {
  try {
    // Get auth token
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    
    // Verify user
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await req.formData();
    const files = formData.getAll('files');
    const projectId = formData.get('projectId');
    const folderId = formData.get('folderId') || null;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    // Check project access if not general
    if (projectId !== 'general') {
      const project = await db.collection('projects').findOne({ 
        _id: new ObjectId(projectId) 
      });

      if (project) {
        const isMember = project.members?.some(m => m.user === user.username);
        const isSuperManager = project.superManager === user.username;
        const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
        
        if (!isMember && !isSuperManager && !isAdmin) {
          return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 });
        }
      }
    }

    // Verify folder access if specified
    if (folderId) {
      const folder = await db.collection('doc_folders').findOne({ 
        _id: new ObjectId(folderId) 
      });
      
      if (!folder || folder.projectId !== projectId) {
        return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
      }
    }

    const bucket = new GridFSBucket(db);
    const uploadedFiles = [];

    // Upload each file to GridFS
    for (const file of files) {
      try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadStream = bucket.openUploadStream(file.name, {
          metadata: {
            originalName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            uploadedBy: user.username,
            uploadedByEmail: user.email,
            projectId: projectId,
            folderId: folderId,
            isDocumentationResource: true,
            uploadDate: new Date()
          }
        });

        await new Promise((resolve, reject) => {
          uploadStream.end(buffer, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });

        // Create resource entry
        const resourceDoc = {
          fileId: uploadStream.id,
          name: file.name,
          originalName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          projectId: projectId,
          folderId: folderId,
          uploadedBy: {
            userId: user._id,
            username: user.username,
            email: user.email
          },
          downloads: 0,
          views: 0,
          isPasswordProtected: false,
          currentVersion: 1,
          versions: [{
            version: 1,
            fileId: uploadStream.id,
            uploadedAt: new Date(),
            uploadedBy: user.username,
            changes: 'Initial upload'
          }],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await db.collection('resources').insertOne(resourceDoc);
        uploadedFiles.push({ ...resourceDoc, _id: result.insertedId });

        // Log activity
        await db.collection('doc_activity_logs').insertOne({
          projectId: projectId,
          action: 'file_uploaded',
          targetType: 'file',
          targetId: result.insertedId,
          targetName: file.name,
          user: {
            userId: user._id,
            username: user.username,
            email: user.email
          },
          details: {
            fileSize: file.size,
            mimeType: file.type,
            folderId: folderId
          },
          timestamp: new Date()
        });

      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        // Continue with other files
      }
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json({ error: 'Failed to upload any files' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      files: uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully` 
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to upload files',
      details: error.message 
    }, { status: 500 });
  }
}
