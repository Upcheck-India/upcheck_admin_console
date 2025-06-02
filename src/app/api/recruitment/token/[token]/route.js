// src/app/api/recruitment/token/[token]/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";

export async function GET(req, { params }) {
  try {
    const { token } = params;
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    // Check both invitations and candidates collections for the token
    let invitation = await db.collection('invitations').findOne({ token });
    let candidate = null;
    
    // If not found in invitations, check candidates collection
    if (!invitation) {
      candidate = await db.collection('candidates').findOne({ token });
      
      if (!candidate) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
      }
      
      // Use candidate data instead of invitation
      invitation = {
        id: candidate.id,
        testId: candidate.testId,
        email: candidate.email,
        name: candidate.name,
        status: candidate.status,
        expiresAt: candidate.expiresAt,
        completedAt: candidate.completedAt
      };
    }
    
    // Check if invitation has expired
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Test invitation has expired' }, { status: 400 });
    }
    
    // Check if test has already been completed
    if (invitation.status === 'completed') {
      return NextResponse.json({ error: 'Test already completed' }, { status: 400 });
    }
    
    // Check if there's already a submission for this candidate/invitation
    const existingSubmission = await db.collection('submissions').findOne({
      $or: [
        { invitationId: invitation.id },
        { candidateId: invitation.id, testId: invitation.testId }
      ]
    });
    
    if (existingSubmission) {
      // Update status to completed if not already set
      if (invitation.status !== 'completed') {
        if (candidate) {
          await db.collection('candidates').updateOne(
            { id: candidate.id },
            { $set: { status: 'completed', completedAt: new Date() } }
          );
        } else {
          await db.collection('invitations').updateOne(
            { id: invitation.id },
            { $set: { status: 'completed', completedAt: new Date() } }
          );
        }
      }
      return NextResponse.json({ error: 'Test already submitted', submissionId: existingSubmission.id }, { status: 400 });
    }
    
    // Get the test details
    const test = await db.collection('tests').findOne({ id: invitation.testId });
    
    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }
    
    // Remove sensitive information and correct answers from the test
    const sanitizedTest = {
      id: test.id,
      title: test.title,
      description: test.description,
      timeLimit: test.timeLimit || test.duration, // Support both field names
      dueDate: test.dueDate,
      securitySettings: test.securitySettings || {
        fullScreenRequired: false,
        maxWarnings: 3,
        actionOnMaxWarnings: 'terminate'
      },
      questions: test.questions.map(q => ({
        id: q.id,
        type: q.type,
        text: q.text,
        points: q.points,
        options: q.options,
        // Remove correct answers
        correctAnswer: undefined
      }))
    };
    
    return NextResponse.json({
      test: sanitizedTest,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
