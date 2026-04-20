import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';

// GET /api/dataroom/share/validate?token=xxx - Validate share token and get resource info
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Share token required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const share = await db.collection('dataroom_shares').findOne({ shareToken: token });

    if (!share) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 404 });
    }

    if (share.revokedAt) {
      return NextResponse.json({ error: 'This share link has been revoked' }, { status: 403 });
    }

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This share link has expired' }, { status: 403 });
    }

    // Get resource details
    let resourceDetails = null;
    if (share.resourceType === 'document') {
      resourceDetails = await db.collection('dataroom_documents').findOne(
        { _id: share.resourceId },
        { projection: { name: 1, mimeType: 1, size: 1 } }
      );
    } else if (share.resourceType === 'folder') {
      resourceDetails = await db.collection('dataroom_folders').findOne(
        { _id: share.resourceId },
        { projection: { name: 1 } }
      );
    } else if (share.resourceType === 'room') {
      resourceDetails = await db.collection('dataroom_rooms').findOne(
        { _id: share.resourceId },
        { projection: { name: 1, description: 1 } }
      );
    }

    if (!resourceDetails) {
      return NextResponse.json({ error: 'Shared resource not found' }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      share: {
        id: share._id,
        resourceType: share.resourceType,
        resourceId: share.resourceId,
        resourceName: resourceDetails.name,
        permissions: share.permissions,
        targetEmail: share.targetEmail,
        expiresAt: share.expiresAt,
      },
    });

  } catch (error) {
    console.error('GET /api/dataroom/share/validate error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
