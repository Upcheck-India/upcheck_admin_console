// @public-route validates a share token presented by an unauthenticated recipient
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import {
  linkUnusableReason,
  normalizeShare,
  requirementFor,
} from '../../../../../lib/dataroom/share-links';

// GET /api/dataroom/share/validate?token=xxx
//
// Tells an unauthenticated visitor what the link is and what they must supply
// to use it. It deliberately does NOT report the audience: replying with the
// list of addresses a restricted link admits would turn every link into a
// directory of who has been given access to what. The audience is checked when
// the session is minted, in ../access.
export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Share token required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const share = normalizeShare(
      await db.collection('dataroom_shares').findOne({ shareToken: token }),
    );

    const unusable = linkUnusableReason(share);
    if (unusable) {
      return NextResponse.json({ error: unusable }, { status: share ? 403 : 404 });
    }

    const collections = {
      document: ['dataroom_documents', { name: 1, mimeType: 1, fileSize: 1 }],
      folder: ['dataroom_folders', { name: 1 }],
      room: ['dataroom_rooms', { name: 1, description: 1 }],
    };
    const spec = collections[share.resourceType];
    if (!spec) {
      return NextResponse.json({ error: 'Shared resource not found' }, { status: 404 });
    }

    const resource = await db
      .collection(spec[0])
      .findOne({ _id: share.resourceId, isDeleted: { $ne: true } }, { projection: spec[1] });

    if (!resource) {
      return NextResponse.json({ error: 'Shared resource not found' }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      share: {
        resourceType: share.resourceType,
        resourceName: resource.name,
        permissions: share.permissions,
        protection: share.protection,
        expiresAt: share.expiresAt || null,
        ...requirementFor(share),
      },
    });
  } catch (error) {
    console.error('GET /api/dataroom/share/validate error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
