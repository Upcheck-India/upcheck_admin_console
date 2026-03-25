import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import clientPromise from '../../../../lib/mongodb';
import bcrypt from 'bcryptjs';

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
    const storageProvider = formData.get('storageProvider') || 'server';
    const externalUrl = formData.get('externalUrl') || null;
    const password = formData.get('password') || null;

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

    // Check server settings for Intern upload restrictions
    const serverSettings = await db.collection('server_settings').findOne({});
    const isIntern = user.role === 'Intern';

    if (isIntern && serverSettings && !serverSettings.allowInternUpload) {
      return NextResponse.json({ error: 'Interns are not allowed to upload files' }, { status: 403 });
    }

    // Validate file types for Interns
    if (isIntern && serverSettings?.allowedFileTypes?.length > 0) {
      for (const file of files) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!serverSettings.allowedFileTypes.includes(ext)) {
          return NextResponse.json({
            error: `File type "${ext}" is not allowed for interns. Allowed: ${serverSettings.allowedFileTypes.join(', ')}`
          }, { status: 400 });
        }
      }
    }

    // Validate file size
    const maxFileSizeMB = serverSettings?.maxFileSize || 50;
    const maxFileSize = maxFileSizeMB * 1024 * 1024;

    for (const file of files) {
      if (file.size > maxFileSize) {
        return NextResponse.json({
          error: `File "${file.name}" exceeds maximum size of ${maxFileSizeMB}MB`
        }, { status: 400 });
      }
    }

    const bucket = new GridFSBucket(db);
    const uploadedFiles = [];

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Upload each file to GridFS (for server storage) or just create resource entry (for external)
    for (const file of files) {
      try {
        let fileId = null;

        // Only upload to GridFS if using server storage
        if (storageProvider === 'server') {
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
              storageProvider: storageProvider,
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

          fileId = uploadStream.id;
        }

        // Create resource entry
        const resourceDoc = {
          fileId: fileId,
          name: file.name,
          originalName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          projectId: projectId,
          folderId: folderId,
          storageProvider: storageProvider,
          externalUrl: storageProvider !== 'server' ? externalUrl : null,
          uploadedBy: {
            userId: user._id,
            username: user.username,
            email: user.email
          },
          downloads: 0,
          views: 0,
          isPasswordProtected: !!password,
          passwordHash: hashedPassword,
          currentVersion: 1,
          versions: [{
            version: 1,
            fileId: fileId,
            uploadedAt: new Date(),
            uploadedBy: user.username,
            changes: 'Initial upload'
          }],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await db.collection('resources').insertOne(resourceDoc);

        // Create initial version entry in doc_versions collection
        await db.collection('doc_versions').insertOne({
          resourceId: result.insertedId,
          versionNumber: 1,
          fileId: fileId,
          fileName: file.name,
          fileSize: file.size,
          changeNote: 'Initial upload',
          createdBy: {
            userId: user._id,
            username: user.username,
            email: user.email
          },
          createdAt: new Date(),
          isCurrent: true
        });

        // Don't return password hash to client
        const { passwordHash, ...safeResource } = resourceDoc;
        uploadedFiles.push({ ...safeResource, _id: result.insertedId });

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
            folderId: folderId,
            storageProvider: storageProvider,
            externalUrl: storageProvider !== 'server' ? externalUrl : null,
            isPasswordProtected: !!password
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
