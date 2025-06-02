// src/app/api/recruitment/candidates/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Get all candidates or filter by test ID
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
    
    const candidates = await db.collection('candidates').find(query).toArray();
    
    // Remove password hash from response
    const sanitizedCandidates = candidates.map(candidate => {
      const { passwordHash, ...rest } = candidate;
      return rest;
    });
    
    return NextResponse.json(sanitizedCandidates);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create a new candidate
export async function POST(req) {
  try {
    const body = await req.json();
    const { testId, email, name, password } = body;
    
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
    
    // Check if candidate already exists
    const existingCandidate = await db.collection('candidates').findOne({
      testId,
      email: email.toLowerCase()
    });
    
    if (existingCandidate) {
      return NextResponse.json(
        { error: 'Candidate already exists for this email', candidate: existingCandidate }, 
        { status: 409 }
      );
    }
    
    // Generate a random password if not provided
    const candidatePassword = password || Math.random().toString(36).slice(-8);
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(candidatePassword, salt);
    
    // Create new candidate
    const candidateId = uuidv4();
    const token = uuidv4(); // For invitation link
    
    const newCandidate = {
      id: candidateId,
      testId,
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      username: email.toLowerCase(),
      passwordHash,
      token,
      status: 'invited',
      invitedAt: new Date(),
      expiresAt: test.dueDate ? new Date(test.dueDate) : null,
      completedAt: null,
      score: null
    };
    
    await db.collection('candidates').insertOne(newCandidate);
    
    // Update test with new candidate reference
    await db.collection('tests').updateOne(
      { id: testId },
      { 
        $push: { candidates: { 
          id: candidateId, 
          email: email.toLowerCase(), 
          name: name || email.split('@')[0],
          token: token,
          status: 'invited', 
          score: null 
        }},
        $set: { updatedAt: new Date() }
      }
    );
    
    // Return candidate info with plaintext password for email sending
    const candidateResponse = {
      ...newCandidate,
      password: candidatePassword, // Include plaintext password in response for email
      inviteLink: `/recruitment/take/${token}`
    };
    delete candidateResponse.passwordHash; // Remove hash from response
    
    return NextResponse.json({
      success: true,
      candidate: candidateResponse
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update a candidate
export async function PUT(req) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Candidate ID is required' }, 
        { status: 400 }
      );
    }
    
    // Don't allow updating certain fields
    delete updateData.id;
    delete updateData.testId;
    delete updateData.email;
    
    // If password is being updated, hash it
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(updateData.password, salt);
      delete updateData.password;
    }
    
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    const result = await db.collection('candidates').updateOne(
      { id },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }
    
    // If status is updated, also update in test's candidates array
    if (updateData.status || updateData.score) {
      const candidate = await db.collection('candidates').findOne({ id });
      
      await db.collection('tests').updateOne(
        { id: candidate.testId, 'candidates.id': id },
        { 
          $set: { 
            'candidates.$.status': updateData.status || candidate.status,
            'candidates.$.score': updateData.score !== undefined ? updateData.score : candidate.score
          } 
        }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Delete a candidate
export async function DELETE(req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Candidate ID is required' }, 
        { status: 400 }
      );
    }
    
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    // Get candidate to find testId
    const candidate = await db.collection('candidates').findOne({ id });
    
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }
    
    // Delete candidate
    await db.collection('candidates').deleteOne({ id });
    
    // Remove from test's candidates array
    await db.collection('tests').updateOne(
      { id: candidate.testId },
      { $pull: { candidates: { id } } }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
