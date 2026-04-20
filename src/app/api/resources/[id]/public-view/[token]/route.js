// src/app/api/resources/[id]/public-view/[token]/route.js
// Serves the file with a valid temporary token for external viewers
import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import clientPromise from '../../../../../../lib/mongodb';
import crypto from 'crypto';

export async function GET(req, { params }) {
  try {
    const { id, token } = await params;

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify the token
    const tokenDoc = await db.collection('temporary_access_tokens').findOne({
      token: token,
      resourceId: new ObjectId(id)
    });

    if (!tokenDoc) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });
    }

    // Check if token is expired
    if (tokenDoc.expiresAt < new Date()) {
      // Clean up expired token
      await db.collection('temporary_access_tokens').deleteOne({ _id: tokenDoc._id });
      return NextResponse.json({ error: 'Token expired' }, { status: 403 });
    }

    // Get the resource
    const resource = await db.collection('resources').findOne({
      _id: new ObjectId(id)
    });

    if (!resource || !resource.fileId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get the file from GridFS
    const bucket = new GridFSBucket(db);
    const fileStream = bucket.openDownloadStream(resource.fileId);

    const chunks = [];
    await new Promise((resolve, reject) => {
      fileStream.on('data', (chunk) => chunks.push(chunk));
      fileStream.on('error', reject);
      fileStream.on('end', resolve);
    });

    const buffer = Buffer.concat(chunks);

    // Return the file with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': resource.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${resource.name}"`,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET'
      }
    });
  } catch (error) {
    console.error('Error serving public file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
