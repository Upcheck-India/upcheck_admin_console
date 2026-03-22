import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - Fetch versions for a document
export async function GET(req) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get('resourceId');

    if (!resourceId) {
      return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
    }

    // Get the resource to check project access
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(resourceId) });
    
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Check project access
    if (resource.projectId && resource.projectId !== 'general') {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(resource.projectId) });
      
      if (project) {
        const isMember = project.members?.some(m => m.user === user.username);
        const isSuperManager = project.superManager === user.username;
        const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
        
        if (!isMember && !isSuperManager && !isAdmin) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    const versions = await db.collection('doc_versions')
      .find({ resourceId: new ObjectId(resourceId) })
      .sort({ versionNumber: -1 })
      .toArray();

    return NextResponse.json(versions);
  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
  }
}

// POST - Create a new version (when uploading new version of file)
export async function POST(req) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resourceId, fileId, fileName, fileSize, changeNote } = await req.json();

    if (!resourceId || !fileId) {
      return NextResponse.json({ error: 'Resource ID and file ID are required' }, { status: 400 });
    }

    // Get current resource
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(resourceId) });
    
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Check access
    if (resource.projectId && resource.projectId !== 'general') {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(resource.projectId) });
      
      if (project) {
        const isMember = project.members?.some(m => m.user === user.username);
        const isSuperManager = project.superManager === user.username;
        const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
        
        if (!isMember && !isSuperManager && !isAdmin) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    // Get the latest version number
    const latestVersion = await db.collection('doc_versions')
      .findOne({ resourceId: new ObjectId(resourceId) }, { sort: { versionNumber: -1 } });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    // Save current version as historical version before updating
    if (resource.fileId) {
      await db.collection('doc_versions').insertOne({
        resourceId: new ObjectId(resourceId),
        versionNumber: latestVersion?.versionNumber || 1,
        fileId: resource.fileId,
        fileName: resource.name,
        fileSize: resource.fileSize,
        changeNote: latestVersion ? 'Previous version' : 'Initial version',
        createdBy: resource.uploadedBy || {
          username: 'System'
        },
        createdAt: resource.updatedAt || resource.createdAt || new Date()
      });
    }

    // Create new version entry
    const newVersion = {
      resourceId: new ObjectId(resourceId),
      versionNumber: newVersionNumber,
      fileId,
      fileName: fileName || resource.name,
      fileSize: fileSize || resource.fileSize,
      changeNote: changeNote || `Version ${newVersionNumber}`,
      createdBy: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      createdAt: new Date(),
      isCurrent: true
    };

    // Update previous versions to not be current
    await db.collection('doc_versions').updateMany(
      { resourceId: new ObjectId(resourceId) },
      { $set: { isCurrent: false } }
    );

    const result = await db.collection('doc_versions').insertOne(newVersion);

    // Update the resource with new file
    await db.collection('resources').updateOne(
      { _id: new ObjectId(resourceId) },
      { 
        $set: { 
          fileId,
          currentVersion: newVersionNumber,
          updatedAt: new Date(),
          updatedBy: {
            userId: user._id,
            username: user.username,
            email: user.email
          }
        } 
      }
    );

    // Log activity
    await db.collection('doc_activity_logs').insertOne({
      projectId: resource.projectId,
      action: 'version_created',
      targetType: 'resource',
      targetId: new ObjectId(resourceId),
      targetName: resource.name,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      details: { 
        versionNumber: newVersionNumber,
        changeNote: changeNote || `Version ${newVersionNumber}`
      },
      timestamp: new Date()
    });

    return NextResponse.json({ _id: result.insertedId, ...newVersion }, { status: 201 });
  } catch (error) {
    console.error('Error creating version:', error);
    return NextResponse.json({ error: 'Failed to create version' }, { status: 500 });
  }
}

// PUT - Revert to a specific version
export async function PUT(req) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resourceId, versionId } = await req.json();

    if (!resourceId || !versionId) {
      return NextResponse.json({ error: 'Resource ID and version ID are required' }, { status: 400 });
    }

    // Get the version to revert to
    const version = await db.collection('doc_versions').findOne({ _id: new ObjectId(versionId) });
    
    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Get the resource
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(resourceId) });
    
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Check access
    if (resource.projectId && resource.projectId !== 'general') {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(resource.projectId) });
      
      if (project) {
        const isMember = project.members?.some(m => m.user === user.username && ['Project Manager', 'Super Manager'].includes(m.role));
        const isSuperManager = project.superManager === user.username;
        const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
        
        if (!isMember && !isSuperManager && !isAdmin) {
          return NextResponse.json({ error: 'Only project managers can revert versions' }, { status: 403 });
        }
      }
    }

    // Save current as a new version before reverting
    const latestVersion = await db.collection('doc_versions')
      .findOne({ resourceId: new ObjectId(resourceId) }, { sort: { versionNumber: -1 } });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    // Create revert version entry
    await db.collection('doc_versions').insertOne({
      resourceId: new ObjectId(resourceId),
      versionNumber: newVersionNumber,
      fileId: version.fileId,
      fileName: version.fileName,
      fileSize: version.fileSize,
      changeNote: `Reverted to version ${version.versionNumber}`,
      createdBy: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      createdAt: new Date(),
      isCurrent: true,
      revertedFrom: version.versionNumber
    });

    // Update all versions
    await db.collection('doc_versions').updateMany(
      { resourceId: new ObjectId(resourceId), _id: { $ne: new ObjectId(versionId) } },
      { $set: { isCurrent: false } }
    );

    // Update the resource
    await db.collection('resources').updateOne(
      { _id: new ObjectId(resourceId) },
      { 
        $set: { 
          fileId: version.fileId,
          currentVersion: newVersionNumber,
          updatedAt: new Date(),
          updatedBy: {
            userId: user._id,
            username: user.username,
            email: user.email
          }
        } 
      }
    );

    // Log activity
    await db.collection('doc_activity_logs').insertOne({
      projectId: resource.projectId,
      action: 'version_reverted',
      targetType: 'resource',
      targetId: new ObjectId(resourceId),
      targetName: resource.name,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      details: { 
        revertedToVersion: version.versionNumber,
        newVersionNumber
      },
      timestamp: new Date()
    });

    return NextResponse.json({ success: true, newVersionNumber });
  } catch (error) {
    console.error('Error reverting version:', error);
    return NextResponse.json({ error: 'Failed to revert version' }, { status: 500 });
  }
}
