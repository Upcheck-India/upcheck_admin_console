// src/app/api/recruitment/submissions/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";

export async function GET(req, { params }) {
  try {
    const { id } = params;
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    const submission = await db.collection('submissions').findOne({ id });
    
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }
    
    return NextResponse.json(submission);
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
    
    // Get the current submission
    const currentSubmission = await db.collection('submissions').findOne({ id });
    
    if (!currentSubmission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }
    
    // For manual scoring
    if (body.manualScore) {
      let newTotalScore = 0;
      
      // Add auto-scored points
      Object.values(currentSubmission.autoScore || {}).forEach(score => {
        newTotalScore += score;
      });
      
      // Add manually scored points
      Object.values(body.manualScore).forEach(score => {
        newTotalScore += score;
      });
      
      body.totalScore = newTotalScore;
      body.percentageScore = Math.round((newTotalScore / currentSubmission.maxPossibleScore) * 100) || 0;
      body.status = 'evaluated';
      body.evaluatedAt = new Date();
    }
    
    const result = await db.collection('submissions').updateOne(
      { id },
      { $set: body }
    );
    
    // If the score was updated, update the invitation and test candidate score as well
    if (body.percentageScore !== undefined) {
      // Update invitation score
      await db.collection('invitations').updateOne(
        { id: currentSubmission.invitationId },
        { $set: { score: body.percentageScore } }
      );
      
      // Update test candidate score
      await db.collection('tests').updateOne(
        { id: currentSubmission.testId, 'candidates.email': currentSubmission.candidateEmail },
        { $set: { 'candidates.$.score': body.percentageScore } }
      );
    }
    
    // Get the updated submission
    const updated = await db.collection('submissions').findOne({ id });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
