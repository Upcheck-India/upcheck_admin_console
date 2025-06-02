// src/app/api/recruitment/invitations/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";

export async function GET(req, { params }) {
  try {
    const { id } = params;
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    const invitation = await db.collection('invitations').findOne({ id });
    
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    
    return NextResponse.json(invitation);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    const updatedInvitation = {
      ...body,
      updatedAt: new Date()
    };
    
    // Remove id from the update object to prevent overwriting
    delete updatedInvitation.id;
    
    const result = await db.collection('invitations').updateOne(
      { id },
      { $set: updatedInvitation }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    
    // Get the updated invitation
    const updated = await db.collection('invitations').findOne({ id });
    
    // If status changed to completed, update the test's candidate status
    if (updated.status === 'completed' && body.status === 'completed') {
      await db.collection('tests').updateOne(
        { id: updated.testId, 'candidates.email': updated.email },
        { 
          $set: { 
            'candidates.$.status': 'completed',
            'candidates.$.score': updated.score,
            updatedAt: new Date()
          },
          $inc: { submissions: 1 }
        }
      );
    }
    
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params;
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    // Get the invitation first to get the testId and email
    const invitation = await db.collection('invitations').findOne({ id });
    
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    
    // Check if the invitation has been completed
    if (invitation.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot delete a completed invitation' }, 
        { status: 400 }
      );
    }
    
    // Delete the invitation
    const result = await db.collection('invitations').deleteOne({ id });
    
    // Remove the candidate from the test
    await db.collection('tests').updateOne(
      { id: invitation.testId },
      { 
        $pull: { candidates: { email: invitation.email } },
        $set: { updatedAt: new Date() }
      }
    );
    
    return NextResponse.json({ success: true, message: 'Invitation deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
