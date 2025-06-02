// src/app/api/recruitment/tests/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";

export async function GET(req, { params }) {
  try {
    const { id } = params;
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    const test = await db.collection('tests').findOne({ id });
    
    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }
    
    return NextResponse.json(test);
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
    
    const updatedTest = {
      ...body,
      updatedAt: new Date()
    };
    
    // Remove id from the update object to prevent overwriting
    delete updatedTest.id;
    
    const result = await db.collection('tests').updateOne(
      { id },
      { $set: updatedTest }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }
    
    // Get the updated test
    const updated = await db.collection('tests').findOne({ id });
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
    
    // Check if there are any submissions for this test
    const submissionsCount = await db.collection('submissions').countDocuments({ testId: id });
    
    if (submissionsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete test with submissions. Archive it instead.' }, 
        { status: 400 }
      );
    }
    
    const result = await db.collection('tests').deleteOne({ id });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }
    
    // Also delete any invitations for this test
    await db.collection('invitations').deleteMany({ testId: id });
    
    return NextResponse.json({ success: true, message: 'Test deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
