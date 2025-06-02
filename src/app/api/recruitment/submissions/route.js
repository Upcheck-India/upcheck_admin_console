// src/app/api/recruitment/submissions/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import { v4 as uuidv4 } from 'uuid';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const testId = url.searchParams.get('testId');
    const candidateEmail = url.searchParams.get('email');
    const id = url.searchParams.get('id');
    
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    // If fetching a specific submission by ID
    if (id) {
      const submission = await db.collection('submissions').findOne({ id });
      if (!submission) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }
      
      // Get test details for this submission
      const test = await db.collection('tests').findOne({ id: submission.testId });
      if (test) {
        submission.testTitle = test.title;
        submission.passingScore = test.passingScore || 70;
      }
      
      return NextResponse.json(submission);
    }
    
    // For multiple submissions
    let query = {};
    if (testId) {
      query.testId = testId;
    }
    if (candidateEmail) {
      query.candidateEmail = candidateEmail.toLowerCase();
    }
    
    const submissions = await db.collection('submissions').find(query).toArray();
    
    // Enhance submissions with test information
    const testIds = [...new Set(submissions.map(s => s.testId))];
    const tests = await db.collection('tests').find({ id: { $in: testIds } }).toArray();
    const testsMap = tests.reduce((map, test) => {
      map[test.id] = test;
      return map;
    }, {});
    
    // Add test information to each submission
    const enhancedSubmissions = submissions.map(submission => {
      const test = testsMap[submission.testId];
      return {
        ...submission,
        testTitle: test?.title || 'Unknown Test',
        passingScore: test?.passingScore || 70,
        // Calculate status based on score if not already set
        status: submission.status || (submission.percentageScore >= (test?.passingScore || 70) ? 'passed' : 'failed')
      };
    });
    
    return NextResponse.json(enhancedSubmissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { testId, invitationId, candidateId, candidateEmail, candidateName, answers, timeSpent } = body;
    
    if (!testId || !candidateEmail || !answers) {
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      );
    }
    
    // Either invitationId or candidateId should be present
    if (!invitationId && !candidateId) {
      return NextResponse.json(
        { error: 'Either invitationId or candidateId is required' }, 
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
    
    // Check if invitation or candidate exists and is valid
    let invitation = null;
    let candidate = null;
    
    if (invitationId) {
      invitation = await db.collection('invitations').findOne({
        id: invitationId,
        email: candidateEmail.toLowerCase()
      });
      
      if (!invitation) {
        return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 });
      }
      
      if (invitation.status === 'completed') {
        return NextResponse.json({ error: 'Test already completed' }, { status: 400 });
      }
      
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return NextResponse.json({ error: 'Test invitation has expired' }, { status: 400 });
      }
    } else if (candidateId) {
      // Check if candidate exists and is valid
      candidate = await db.collection('candidates').findOne({
        id: candidateId,
        email: candidateEmail.toLowerCase()
      });
      
      if (!candidate) {
        return NextResponse.json({ error: 'Invalid candidate' }, { status: 400 });
      }
      
      // Check if candidate already submitted the test
      const existingSubmission = await db.collection('submissions').findOne({
        candidateId: candidateId,
        testId: testId
      });
      
      if (existingSubmission) {
        return NextResponse.json({ error: 'Test already completed by this candidate' }, { status: 400 });
      }
    }
    
    // Calculate auto-scores for objective questions
    const autoScore = {};
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    test.questions.forEach(question => {
      maxPossibleScore += question.points;
      
      if (question.type === 'mcq' || question.type === 'single' || question.type === 'multiple-choice' || question.type === 'true-false') {
        const userAnswer = answers[question.id];
        
        // Handle MCQ (multiple correct answers)
        if (question.type === 'mcq' && Array.isArray(userAnswer) && Array.isArray(question.correctAnswer)) {
          // Check if arrays match (all correct options selected and no incorrect ones)
          const correctAnswersSet = new Set(question.correctAnswer);
          const userAnswersSet = new Set(userAnswer);
          
          // For full points, user must select all correct answers and no incorrect ones
          let isFullyCorrect = true;
          
          // Check if user selected all correct answers
          for (const correctOption of correctAnswersSet) {
            if (!userAnswersSet.has(correctOption)) {
              isFullyCorrect = false;
              break;
            }
          }
          
          // Check if user didn't select any incorrect answers
          if (isFullyCorrect) {
            for (const userOption of userAnswersSet) {
              if (!correctAnswersSet.has(userOption)) {
                isFullyCorrect = false;
                break;
              }
            }
          }
          
          if (isFullyCorrect) {
            autoScore[question.id] = question.points;
            totalScore += question.points;
          } else {
            autoScore[question.id] = 0;
          }
        } 
        // Handle single choice questions
        else if ((question.type === 'single' || question.type === 'multiple-choice' || question.type === 'true-false') && userAnswer === question.correctAnswer) {
          autoScore[question.id] = question.points;
          totalScore += question.points;
        } else {
          autoScore[question.id] = 0;
        }
      }
      // Text questions will be scored manually
      else if (question.type === 'text') {
        autoScore[question.id] = 0; // Default to 0 for manual scoring
      }
    });
    
    // Get passing score from test
    const passingScore = test.passingScore || 70; // Default to 70% if not specified
    
    // Calculate percentage score
    const percentageScore = Math.round((totalScore / maxPossibleScore) * 100) || 0;
    
    // Determine submission status based on score
    const submissionStatus = percentageScore >= passingScore ? 'passed' : 'failed';
    
    // Create submission
    const newSubmission = {
      id: uuidv4(),
      testId,
      testTitle: test.title,
      candidateEmail: candidateEmail.toLowerCase(),
      candidateName: candidateName || (invitation?.name || candidate?.name),
      answers,
      autoScore,
      manualScore: {},
      totalScore,
      maxPossibleScore,
      percentageScore,
      passingScore,
      
      // Add appropriate ID based on submission type
      ...(invitationId ? { invitationId } : {}),
      ...(candidateId ? { candidateId } : {}),
      status: submissionStatus,
      evaluationStatus: 'submitted', // 'submitted', 'evaluated'
      timeSpent: timeSpent || 0,
      submittedAt: new Date(),
      evaluatedAt: null,
      evaluatedBy: null
    };
    
    await db.collection('submissions').insertOne(newSubmission);
    
    // Update invitation status
    await db.collection('invitations').updateOne(
      { id: invitationId },
      { 
        $set: {
          status: 'completed',
          completedAt: new Date(),
          score: newSubmission.percentageScore
        }
      }
    );
    
    // Update test candidate status
    await db.collection('tests').updateOne(
      { id: testId, 'candidates.email': candidateEmail.toLowerCase() },
      { 
        $set: { 
          'candidates.$.status': 'completed',
          'candidates.$.score': newSubmission.percentageScore,
          updatedAt: new Date()
        },
        $inc: { submissions: 1 }
      }
    );
    
    return NextResponse.json({
      success: true,
      submission: newSubmission
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
