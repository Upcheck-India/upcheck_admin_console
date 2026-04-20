import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId, GridFSBucket } from 'mongodb';
import bcrypt from 'bcryptjs';

// POST - Download shared resource
export async function POST(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { password } = await req.json();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid resource ID' }, { status: 400 });
    }

    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Check project permissions
    if (resource.projectId && resource.projectId !== 'general') {
      const project = await db.collection('projects').findOne({ 
        _id: new ObjectId(resource.projectId) 
      });

      if (project) {
        const isMember = project.members?.some(m => m.user === user.username);
        const isSuperManager = project.superManager === user.username;
        const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
        
        if (!isMember && !isSuperManager && !isAdmin) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    // Verify password if protected
    if (resource.isPasswordProtected) {
      if (!password) {
        return NextResponse.json({ error: 'Password required' }, { status: 403 });
      }
      
      const isValid = await bcrypt.compare(password, resource.password);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
      }
    }

    // Get file from GridFS
    const bucket = new GridFSBucket(db);
    const downloadStream = bucket.openDownloadStream(new ObjectId(resource.fileId));

    // Increment download count
    await db.collection('resources').updateOne(
      { _id: new ObjectId(id) },
      { $inc: { downloads: 1 } }
    );

    // Log download activity
    await db.collection('doc_activity_logs').insertOne({
      projectId: resource.projectId,
      action: 'file_downloaded',
      targetType: 'file',
      targetId: new ObjectId(id),
      targetName: resource.name,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      timestamp: new Date()
    });

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': resource.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${resource.name}"`,
        'Content-Length': buffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
