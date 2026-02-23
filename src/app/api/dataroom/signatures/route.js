import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../lib/dataroom/audit-logger';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user;
  } catch {
    return null;
  }
}

// GET /api/dataroom/signatures - List NDA signatures for a room or user
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const userId = searchParams.get('userId');
    const ndaDocumentId = searchParams.get('ndaDocumentId');
    const status = searchParams.get('status'); // signed | pending | declined

    const client = await clientPromise;
    const db = client.db('resources');

    const filter = {};

    if (roomId) {
      if (!ObjectId.isValid(roomId)) {
        return NextResponse.json({ error: 'Invalid roomId' }, { status: 400 });
      }
      filter.roomId = new ObjectId(roomId);
    }

    if (userId) {
      if (!ObjectId.isValid(userId)) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
      }
      filter.userId = new ObjectId(userId);
    }

    if (ndaDocumentId) {
      if (!ObjectId.isValid(ndaDocumentId)) {
        return NextResponse.json({ error: 'Invalid ndaDocumentId' }, { status: 400 });
      }
      filter.ndaDocumentId = new ObjectId(ndaDocumentId);
    }

    if (status) {
      filter.status = status;
    }

    const signatures = await db.collection('dataroom_signatures')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      count: signatures.length,
      signatures,
    });

  } catch (error) {
    console.error('GET /api/dataroom/signatures error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/dataroom/signatures - Record NDA signature
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      roomId,
      ndaDocumentId,
      signatureType = 'acceptance', // acceptance | wet_signature | e_signature
      signatureData = null, // Base64 signature image or text
      ipAddress = null,
      agreedToTerms = true,
    } = body;

    if (!roomId || !ObjectId.isValid(roomId)) {
      return NextResponse.json({ error: 'Valid roomId is required' }, { status: 400 });
    }

    if (!ndaDocumentId || !ObjectId.isValid(ndaDocumentId)) {
      return NextResponse.json({ error: 'Valid ndaDocumentId is required' }, { status: 400 });
    }

    if (!agreedToTerms) {
      return NextResponse.json({ error: 'Must agree to terms to sign NDA' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify room and NDA document exist
    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(roomId),
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const ndaDocument = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(ndaDocumentId),
      roomId: new ObjectId(roomId),
      isDeleted: { $ne: true },
    });

    if (!ndaDocument) {
      return NextResponse.json({ error: 'NDA document not found' }, { status: 404 });
    }

    // Check if already signed
    const existingSignature = await db.collection('dataroom_signatures').findOne({
      roomId: new ObjectId(roomId),
      ndaDocumentId: new ObjectId(ndaDocumentId),
      userId: user._id,
      status: 'signed',
    });

    if (existingSignature) {
      return NextResponse.json({ error: 'NDA already signed by this user' }, { status: 409 });
    }

    // Create signature record
    const signature = {
      roomId: new ObjectId(roomId),
      ndaDocumentId: new ObjectId(ndaDocumentId),
      userId: user._id,
      userEmail: user.email,
      userName: user.username,
      signatureType,
      signatureData,
      ipAddress: ipAddress || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      agreedToTerms,
      status: 'signed',
      signedAt: new Date(),
      createdAt: new Date(),
    };

    const result = await db.collection('dataroom_signatures').insertOne(signature);

    await logAudit({
      action: 'NDA_SIGNED',
      resourceType: 'signature',
      resourceId: result.insertedId,
      roomId: new ObjectId(roomId),
      user,
      details: {
        ndaDocumentId: ndaDocumentId.toString(),
        ndaDocumentName: ndaDocument.name,
        signatureType,
      },
      request,
    });

    return NextResponse.json({ ...signature, _id: result.insertedId }, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/signatures error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
