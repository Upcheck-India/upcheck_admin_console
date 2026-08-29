import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';

// POST /api/dataroom/documents/[id]/lock - Lock document for editing
export const POST = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if already locked
    if (document.isLocked) {
      if (document.lockedBy === user._id.toString()) {
        // Already locked by same user - refresh lock timeout
        await db.collection('dataroom_documents').updateOne(
          { _id: new ObjectId(id) },
          { $set: { lockedAt: new Date() } }
        );
        return NextResponse.json({ 
          message: 'Lock refreshed', 
          lockedBy: user.email,
          lockedAt: new Date(),
        });
      }
      
      // Locked by another user - check if lock has expired (30 min timeout)
      const lockAge = Date.now() - new Date(document.lockedAt).getTime();
      const LOCK_TIMEOUT = 30 * 60 * 1000; // 30 minutes
      
      if (lockAge < LOCK_TIMEOUT) {
        return NextResponse.json({ 
          error: 'Document is locked by another user',
          lockedBy: document.lockedBy,
          lockedAt: document.lockedAt,
        }, { status: 423 });
      }
      
      // Lock has expired - steal it
    }

    // Lock the document
    await db.collection('dataroom_documents').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isLocked: true,
          lockedBy: user._id.toString(),
          lockedByEmail: user.email,
          lockedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_LOCK,
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId,
      user,
      details: { name: document.name },
      request,
    });

    return NextResponse.json({ 
      success: true,
      lockedBy: user.email,
      lockedAt: new Date(),
    });
  },
  {
    requires: 'edit',
    resource: { type: 'document', param: 'id' },
  },
);

// DELETE /api/dataroom/documents/[id]/lock - Unlock document
export const DELETE = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if document is locked
    if (!document.isLocked) {
      return NextResponse.json({ error: 'Document is not locked' }, { status: 400 });
    }

    // Only allow unlocking by same user or admin override
    if (document.lockedBy !== user._id.toString() && user.role !== 'Admin') {
      return NextResponse.json({ 
        error: 'Cannot unlock document locked by another user',
        lockedBy: document.lockedBy,
      }, { status: 403 });
    }

    // Unlock the document
    await db.collection('dataroom_documents').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isLocked: false,
          lockedBy: null,
          lockedByEmail: null,
          lockedAt: null,
          updatedAt: new Date(),
        },
      }
    );

    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_UNLOCK,
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId,
      user,
      details: { name: document.name, wasLockedBy: document.lockedBy },
      request,
    });

    return NextResponse.json({ success: true });
  },
  {
    requires: 'edit',
    resource: { type: 'document', param: 'id' },
  },
);
