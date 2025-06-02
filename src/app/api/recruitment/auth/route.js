// src/app/api/recruitment/auth/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, password, token } = body;
    
    if ((!username || !password) && !token) {
      return NextResponse.json(
        { error: 'Username and password are required, or a valid token' }, 
        { status: 400 }
      );
    }
    
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    let candidate;
    
    // Find candidate by token or username
    if (token) {
      candidate = await db.collection('candidates').findOne({ token });
    } else {
      candidate = await db.collection('candidates').findOne({ 
        username: username.toLowerCase() 
      });
    }
    
    if (!candidate) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    // If using token, no password check needed
    if (token) {
      // Check if candidate status is already completed
      if (candidate.status === 'completed') {
        // Check for existing submission
        const existingSubmission = await db.collection('submissions').findOne({
          candidateId: candidate.id,
          testId: candidate.testId
        });
        
        if (existingSubmission) {
          return NextResponse.json({ 
            error: 'Test already completed', 
            submissionId: existingSubmission.id 
          }, { status: 400 });
        }
        
        return NextResponse.json({ error: 'Test already completed' }, { status: 400 });
      }
      
      // Get the test for this candidate
      const test = await db.collection('tests').findOne({ id: candidate.testId });
      
      if (!test) {
        return NextResponse.json({ error: 'Test not found' }, { status: 404 });
      }
      
      // Check for existing submission even if status is not completed
      const existingSubmission = await db.collection('submissions').findOne({
        candidateId: candidate.id,
        testId: candidate.testId
      });
      
      if (existingSubmission) {
        // Update candidate status if needed
        if (candidate.status !== 'completed') {
          await db.collection('candidates').updateOne(
            { id: candidate.id },
            { $set: { status: 'completed', completedAt: new Date() } }
          );
        }
        
        return NextResponse.json({ 
          error: 'Test already completed', 
          submissionId: existingSubmission.id 
        }, { status: 400 });
      }
      
      return NextResponse.json({
        success: true,
        candidate: {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          testId: candidate.testId,
          token: candidate.token
        },
        test: test
      });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, candidate.passwordHash);
    
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    // Check if candidate status is already completed
    if (candidate.status === 'completed') {
      // Check for existing submission
      const existingSubmission = await db.collection('submissions').findOne({
        candidateId: candidate.id,
        testId: candidate.testId
      });
      
      if (existingSubmission) {
        return NextResponse.json({ 
          error: 'Test already completed', 
          submissionId: existingSubmission.id 
        }, { status: 400 });
      }
      
      return NextResponse.json({ error: 'Test already completed' }, { status: 400 });
    }
    
    // Get the test for this candidate
    const test = await db.collection('tests').findOne({ id: candidate.testId });
    
    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }
    
    // Check for existing submission even if status is not completed
    const existingSubmission = await db.collection('submissions').findOne({
      candidateId: candidate.id,
      testId: candidate.testId
    });
    
    if (existingSubmission) {
      // Update candidate status if needed
      if (candidate.status !== 'completed') {
        await db.collection('candidates').updateOne(
          { id: candidate.id },
          { $set: { status: 'completed', completedAt: new Date() } }
        );
      }
      
      return NextResponse.json({ 
        error: 'Test already completed', 
        submissionId: existingSubmission.id 
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        testId: candidate.testId,
        token: candidate.token
      },
      test: test
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
