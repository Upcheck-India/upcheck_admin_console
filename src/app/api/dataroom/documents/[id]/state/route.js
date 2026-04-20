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

// PUT /api/dataroom/documents/[id]/state - Change document state (draft/published/archived)
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const body = await request.json();
    const { state, publishNote } = body;

    const validStates = ['draft', 'published', 'archived', 'under_review'];
    if (!state || !validStates.includes(state)) {
      return NextResponse.json({ 
        error: `Invalid state. Must be one of: ${validStates.join(', ')}` 
      }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if document is locked
    if (document.isLocked && document.lockedBy !== user._id.toString()) {
      return NextResponse.json({ 
        error: 'Document is locked by another user',
        lockedBy: document.lockedByEmail,
      }, { status: 423 });
    }

    const oldState = document.state;
    const updates = {
      state,
      updatedAt: new Date(),
    };

    // Track state change history
    if (!document.stateHistory) {
      updates.stateHistory = [];
    }

    await db.collection('dataroom_documents').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: updates,
        $push: {
          stateHistory: {
            from: oldState,
            to: state,
            changedBy: {
              id: user._id.toString(),
              email: user.email,
              username: user.username,
            },
            changedAt: new Date(),
            note: publishNote || null,
          },
        },
      }
    );

    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_STATE_CHANGE,
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId,
      user,
      details: {
        name: document.name,
        oldState,
        newState: state,
        note: publishNote,
      },
      request,
    });

    const updated = await db.collection('dataroom_documents').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updated);

  } catch (error) {
    console.error('PUT /api/dataroom/documents/[id]/state error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
