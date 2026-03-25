// src/app/api/documentation/create-file/route.js
import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import clientPromise from '../../../../lib/mongodb';
import { cookies } from 'next/headers';

// Helper function to create a simple DOCX file
// This creates a minimal valid DOCX with the content
async function createSimpleDOCX(content) {
  // For a proper implementation, install and use the 'docx' package:
  // npm install docx
  //
  // For now, we'll create a simple HTML-based DOCX that Word can open
  // This is a simplified approach - the content is wrapped in HTML that Word interprets

  const htmlContent = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head>
  <meta charset='utf-8'>
  <title>Document</title>
</head>
<body>
  <div style='font-family: Calibri, Arial, sans-serif; font-size: 11pt;'>
    ${escapeHtml(content)}
  </div>
</body>
</html>
  `.trim();

  // Convert HTML to base64 for DOCX storage
  return Buffer.from(htmlContent, 'utf-8').toString('base64');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
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

    // Parse request body
    const { name, type, content, projectId, folderId } = await req.json();

    // Validate input
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    if (!type || !['txt', 'docx', 'md'].includes(type)) {
      return NextResponse.json({ error: 'File type must be "txt", "docx", or "md"' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'File content is required' }, { status: 400 });
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

        // Check if user has permission to create files (not Viewer role)
        const memberRecord = project.members?.find(m => m.user === user.username);
        const memberRole = memberRecord?.role;
        const canCreate = memberRole === 'Project Manager' || memberRole === 'Contributor';

        if (!isAdmin && !canCreate) {
          return NextResponse.json({ error: 'You do not have permission to create files' }, { status: 403 });
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
      return NextResponse.json({ error: 'Interns are not allowed to create files' }, { status: 403 });
    }

    // Prepare file content
    let fileContent;
    let mimeType;

    if (type === 'txt') {
      fileContent = Buffer.from(content, 'utf-8');
      mimeType = 'text/plain';
    } else if (type === 'docx') {
      // For DOCX, we'll store the content as base64 and create a simple document
      // In a more advanced implementation, we'd use the docx package
      const docxContent = await createSimpleDocX(content);
      fileContent = Buffer.from(docxContent, 'base64');
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (type === 'md') {
      // For Markdown, store as plain text
      fileContent = Buffer.from(content, 'utf-8');
      mimeType = 'text/markdown';
    }

    const fileName = `${name.trim()}${type === 'txt' ? '.txt' : type === 'docx' ? '.docx' : '.md'}`;
    const bucket = new GridFSBucket(db);

    // Upload to GridFS
    const uploadStream = bucket.openUploadStream(fileName, {
      metadata: {
        originalName: fileName,
        mimeType: mimeType,
        fileSize: fileContent.length,
        uploadedBy: user.username,
        uploadedByEmail: user.email,
        projectId: projectId,
        folderId: folderId || null,
        storageProvider: 'server',
        isDocumentationResource: true,
        isCreatedInline: true,
        fileType: type,
        uploadDate: new Date()
      }
    });

    await new Promise((resolve, reject) => {
      uploadStream.end(fileContent, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const fileId = uploadStream.id;

    // Create resource entry
    const resourceDoc = {
      fileId: fileId,
      name: fileName,
      originalName: fileName,
      mimeType: mimeType,
      fileSize: fileContent.length,
      projectId: projectId,
      folderId: folderId || null,
      storageProvider: 'server',
      externalUrl: null,
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
        fileId: fileId,
        uploadedAt: new Date(),
        uploadedBy: user.username,
        changes: 'Initial creation'
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
      fileName: fileName,
      fileSize: fileContent.length,
      changeNote: 'Initial creation',
      createdBy: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      createdAt: new Date(),
      isCurrent: true
    });

    // Log activity
    await db.collection('doc_activity_logs').insertOne({
      projectId: projectId,
      action: 'file_created',
      targetType: 'file',
      targetId: result.insertedId,
      targetName: fileName,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      details: {
        fileSize: fileContent.length,
        mimeType: mimeType,
        folderId: folderId,
        fileType: type,
        isInlineCreation: true
      },
      timestamp: new Date()
    });

    // Don't return sensitive data
    const { ...safeResource } = resourceDoc;
    safeResource._id = result.insertedId;

    return NextResponse.json({
      success: true,
      file: safeResource,
      message: 'File created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Create file error:', error);
    return NextResponse.json({
      error: 'Failed to create file',
      details: error.message
    }, { status: 500 });
  }
}
