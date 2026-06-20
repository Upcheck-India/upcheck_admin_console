// src/app/api/documentation/files/[id]/route.js
import { NextResponse } from 'next/server';
import { ObjectId, GridFSBucket } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { cookies } from 'next/headers';
import { canAccessProject, canReadFile, canWriteFile, canAccessGeneralSpace, getGeneralSpacePermissionLevel } from '../../../../../lib/projectPermissions';

// Helper to fetch user's teams for permission checking
async function getUserTeams(db, user) {
  const userIdStr = user._id?.toString();
  if (!userIdStr) return [];
  return await db.collection('teams')
    .find({
      $or: [
        { members: userIdStr },
        { lead: userIdStr },
        { members: user._id },
        { lead: user._id },
      ],
    })
    .toArray();
}

// GET - Fetch file content by ID
export async function GET(req, { params }) {
  try {
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user teams for team-based permission checking
    const userTeams = await getUserTeams(db, user);

    // Get the resource
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });

    if (!resource) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check project access and permissions
    if (resource.projectId === 'general') {
      const generalPerms = await db.collection('general_space_permissions').findOne({ _id: 'general' });
      const permSettings = generalPerms?.permissionSettings;

      if (!canAccessGeneralSpace(user, permSettings)) {
        return NextResponse.json({ error: 'Access denied to General space' }, { status: 403 });
      }

      const perms = getGeneralSpacePermissionLevel(user, permSettings);
      if (!perms || perms.readScope === 'none') {
        return NextResponse.json({ error: 'Access denied to this file' }, { status: 403 });
      }

      if (perms.readScope === 'own') {
        const isOwnFile = resource.createdBy === user.username || resource.uploadedBy?.username === user.username;
        if (!isOwnFile) {
          return NextResponse.json({ error: 'Access denied to this file' }, { status: 403 });
        }
      }
    } else {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(resource.projectId)
      });

      if (project) {
        if (!canAccessProject(user, project, userTeams)) {
          return NextResponse.json({ error: 'Access denied to this file' }, { status: 403 });
        }

        if (!canReadFile(user, project, resource, userTeams)) {
          return NextResponse.json({ error: 'Access denied to this file' }, { status: 403 });
        }
      }
    }

    // Get file content from GridFS
    let content = '';
    let contentType = resource.mimeType || 'text/plain';

    if (resource.fileId) {
      const bucket = new GridFSBucket(db);
      const fileStream = bucket.openDownloadStream(resource.fileId);

      content = await new Promise((resolve, reject) => {
        const chunks = [];
        fileStream.on('data', (chunk) => chunks.push(chunk));
        fileStream.on('error', reject);
        fileStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          // For text files and markdown, return as string
          // For DOCX files, return as base64
          if (contentType === 'text/plain' || contentType === 'text/markdown') {
            resolve(buffer.toString('utf-8'));
          } else {
            resolve(buffer.toString('base64'));
          }
        });
      });
    }

    return NextResponse.json({
      _id: resource._id,
      name: resource.name,
      content: content,
      contentType: contentType,
      fileType: resource.fileType || (contentType === 'text/plain' ? 'txt' : contentType === 'text/markdown' ? 'md' : 'docx'),
      projectId: resource.projectId,
      folderId: resource.folderId,
      version: resource.currentVersion
    });

  } catch (error) {
    console.error('Fetch file error:', error);
    return NextResponse.json({
      error: 'Failed to fetch file',
      details: error.message
    }, { status: 500 });
  }
}

// PUT - Update file content
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const { content, version } = await req.json();

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'File content is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user teams for team-based permission checking
    const userTeams = await getUserTeams(db, user);

    // Get the resource
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });

    if (!resource) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check project permissions
    let canEdit = false;

    if (resource.projectId === 'general') {
      const generalPerms = await db.collection('general_space_permissions').findOne({ _id: 'general' });
      const permSettings = generalPerms?.permissionSettings;

      if (!canAccessGeneralSpace(user, permSettings)) {
        return NextResponse.json({ error: 'Access denied to General space' }, { status: 403 });
      }

      const perms = getGeneralSpacePermissionLevel(user, permSettings);
      if (!perms || perms.writeScope === 'none') {
        return NextResponse.json({ error: 'You do not have permission to edit this file' }, { status: 403 });
      }

      if (perms.writeScope === 'all') {
        canEdit = true;
      } else if (perms.writeScope === 'own') {
        const isOwnFile = resource.createdBy === user.username || resource.uploadedBy?.username === user.username;
        canEdit = isOwnFile;
      }
    } else {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(resource.projectId)
      });

      if (project) {
        if (!canAccessProject(user, project, userTeams)) {
          return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 });
        }

        canEdit = canWriteFile(user, project, resource, userTeams);
      }
    }

    if (!canEdit) {
      return NextResponse.json({ error: 'You do not have permission to edit this file' }, { status: 403 });
    }

    // Prepare new file content
    const mimeType = resource.mimeType || 'text/plain';
    const fileType = resource.fileType || (mimeType === 'text/plain' ? 'txt' : mimeType === 'text/markdown' ? 'md' : 'docx');

    let fileContent;
    if (fileType === 'txt' || fileType === 'md') {
      fileContent = Buffer.from(content, 'utf-8');
    } else if (fileType === 'docx') {
      // For DOCX, we'll create a simple HTML-based DOCX
      const docxContent = await createSimpleDOCX(content);
      fileContent = Buffer.from(docxContent, 'base64');
    }

    const bucket = new GridFSBucket(db);

    // Delete old file version
    if (resource.fileId) {
      try {
        await bucket.delete(resource.fileId);
      } catch (e) {
        console.error('Error deleting old file version:', e);
      }
    }

    // Upload new version to GridFS
    const fileName = resource.name || `document.${fileType}`;

    const uploadStream = bucket.openUploadStream(fileName, {
      metadata: {
        originalName: fileName,
        mimeType: mimeType,
        fileSize: fileContent.length,
        uploadedBy: user.username,
        uploadedByEmail: user.email,
        projectId: resource.projectId,
        folderId: resource.folderId,
        storageProvider: 'server',
        isDocumentationResource: true,
        isCreatedInline: true,
        fileType: fileType,
        uploadDate: new Date(),
        version: (version || resource.currentVersion) + 1
      }
    });

    await new Promise((resolve, reject) => {
      uploadStream.end(fileContent, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const newFileId = uploadStream.id;
    const newVersion = (version || resource.currentVersion) + 1;

    // Update resource entry
    await db.collection('resources').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          fileId: newFileId,
          fileSize: fileContent.length,
          currentVersion: newVersion,
          updatedAt: new Date(),
          versions: [
            ...(resource.versions || []).slice(-9), // Keep last 10 versions
            {
              version: newVersion,
              fileId: newFileId,
              uploadedAt: new Date(),
              uploadedBy: user.username,
              changes: 'Content updated'
            }
          ]
        }
      }
    );

    // Create version entry in doc_versions collection
    await db.collection('doc_versions').updateMany(
      { resourceId: new ObjectId(id) },
      { $set: { isCurrent: false } }
    );
    await db.collection('doc_versions').insertOne({
      resourceId: new ObjectId(id),
      versionNumber: newVersion,
      fileId: newFileId,
      fileName: resource.name,
      fileSize: fileContent.length,
      changeNote: 'Content updated',
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
      projectId: resource.projectId,
      action: 'file_updated',
      targetType: 'file',
      targetId: id,
      targetName: resource.name,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      details: {
        fileSize: fileContent.length,
        version: newVersion,
        folderId: resource.folderId
      },
      timestamp: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'File updated successfully',
      version: newVersion
    });

  } catch (error) {
    console.error('Update file error:', error);
    return NextResponse.json({
      error: 'Failed to update file',
      details: error.message
    }, { status: 500 });
  }
}

// Helper function to create a simple DOCX file
async function createSimpleDOCX(content) {
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
