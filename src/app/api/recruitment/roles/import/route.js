import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../../lib/mongodb';

export async function POST(req) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Check permissions
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { perms: 1 } }
    );

    if (!user?.perms?.includes('recruitment.manage')) {
      return NextResponse.json(
        { message: 'Permission denied' },
        { status: 403 }
      );
    }

    const data = await req.json();

    // Basic validation
    if (!Array.isArray(data.questions)) {
      return NextResponse.json(
        { message: 'Invalid format: questions must be an array' },
        { status: 400 }
      );
    }

    // Validate each question
    const validatedQuestions = data.questions.map((q, index) => {
      // Required fields
      if (!q.text || !q.type || !['multiple-choice', 'text'].includes(q.type)) {
        throw new Error(`Question ${index + 1} is missing required fields or has invalid type`);
      }

      // Multiple choice specific validation
      if (q.type === 'multiple-choice') {
        if (!Array.isArray(q.options) || q.options.length === 0) {
          throw new Error(`Question ${index + 1} is missing options`);
        }
        if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
          throw new Error(`Question ${index + 1} has invalid correctAnswer`);
        }
      }

      // Text question specific validation
      if (q.type === 'text' && (!Array.isArray(q.expectedKeywords) || q.expectedKeywords.length === 0)) {
        throw new Error(`Question ${index + 1} is missing expectedKeywords`);
      }

      return {
        text: q.text,
        type: q.type,
        difficulty: q.difficulty || 'medium',
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        expectedKeywords: q.expectedKeywords || []
      };
    });

    return NextResponse.json({
      success: true,
      questions: validatedQuestions
    });
  } catch (error) {
    console.error('Error importing questions:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to import questions' },
      { status: 400 }
    );
  }
}