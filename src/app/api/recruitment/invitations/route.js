// src/app/api/recruitment/invitations/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import { v4 as uuidv4 } from 'uuid';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const testId = url.searchParams.get('testId');
    
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    let query = {};
    if (testId) {
      query.testId = testId;
    }
    
    const invitations = await db.collection('invitations').find(query).toArray();
    return NextResponse.json(invitations);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { testId, email, name } = body;
    
    if (!testId || !email) {
      return NextResponse.json(
        { error: 'Test ID and email are required' }, 
        { status: 400 }
      );
    }
    
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    // Check if test exists
    const test = await db.collection('tests').findOne({ id: testId });
    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }
    
    // Check if invitation already exists
    const existingInvitation = await db.collection('invitations').findOne({
      testId,
      email: email.toLowerCase()
    });
    
    if (existingInvitation) {
      return NextResponse.json(
        { error: 'Invitation already exists for this email', invitation: existingInvitation }, 
        { status: 409 }
      );
    }
    
    // Create new invitation
    const token = uuidv4();
    const newInvitation = {
      id: uuidv4(),
      testId,
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      token,
      status: 'pending',
      sentAt: new Date(),
      expiresAt: test.dueDate ? new Date(test.dueDate) : null,
      completedAt: null,
      score: null
    };
    
    await db.collection('invitations').insertOne(newInvitation);
    
    // Update test with new candidate - include the token in the candidate data
    await db.collection('tests').updateOne(
      { id: testId },
      { 
        $push: { candidates: { 
          id: newInvitation.id, 
          email: email.toLowerCase(), 
          name: name || email.split('@')[0],
          token: token, // Include the token in the candidate data
          status: 'invited', 
          score: null 
        }},
        $set: { updatedAt: new Date() }
      }
    );
    
    // In a real application, you would send an email with the invitation link here
    // For now, we'll just return the token
    
    return NextResponse.json({
      success: true,
      invitation: newInvitation,
      inviteLink: `/recruitment/take/${token}`
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
