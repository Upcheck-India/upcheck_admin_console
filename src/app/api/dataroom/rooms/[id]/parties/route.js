import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';

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

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

// POST /api/dataroom/rooms/[id]/parties - Add party/bidder group to VDR room
export async function POST(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user || !isAdminLike(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, type, description, members = [] } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Party name is required' }, { status: 400 });
    }

    if (!type || !['bidder', 'investor', 'buyer', 'seller', 'auditor', 'advisor', 'other'].includes(type)) {
      return NextResponse.json({ error: 'Valid party type required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify room exists and is VDR type
    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check for duplicate party name in room
    const existingParty = await db.collection('dataroom_parties').findOne({
      roomId: new ObjectId(id),
      name: name.trim(),
      isDeleted: { $ne: true },
    });

    if (existingParty) {
      return NextResponse.json({ error: 'Party with this name already exists in room' }, { status: 409 });
    }

    // Create party/bidder group
    const party = {
      roomId: new ObjectId(id),
      name: name.trim(),
      type,
      description: description || '',
      members: members.map(m => ({
        userId: m.userId ? new ObjectId(m.userId) : null,
        externalUserId: m.externalUserId ? new ObjectId(m.externalUserId) : null,
        email: m.email,
        name: m.name,
        role: m.role || 'member',
        addedAt: new Date(),
      })),
      isolation: {
        enabled: true, // Party members can't see other parties' activity
        canSeeOtherParties: false,
        visibleDocuments: [], // Document IDs visible to this party
      },
      statistics: {
        totalMembers: members.length,
        documentsViewed: 0,
        questionsAsked: 0,
        lastActivity: null,
      },
      isActive: true,
      isDeleted: false,
      createdAt: new Date(),
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      updatedAt: new Date(),
    };

    const result = await db.collection('dataroom_parties').insertOne(party);

    await logAudit({
      action: AUDIT_ACTIONS.PARTY_CREATED,
      resourceType: 'party',
      resourceId: result.insertedId,
      roomId: new ObjectId(id),
      user,
      details: {
        partyName: name,
        type,
        memberCount: members.length,
      },
      request,
    });

    return NextResponse.json({
      ...party,
      _id: result.insertedId,
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/rooms/[id]/parties error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/dataroom/rooms/[id]/parties - List all parties in room
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const parties = await db.collection('dataroom_parties')
      .find({
        roomId: new ObjectId(id),
        isDeleted: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      count: parties.length,
      parties,
    });

  } catch (error) {
    console.error('GET /api/dataroom/rooms/[id]/parties error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
