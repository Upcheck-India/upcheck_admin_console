import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

export async function POST(req) {
  try {
    const { applicantId, password } = await req.json();
    
    const client = await clientPromise;
    const db = client.db("resources");
    
    const applicant = await db.collection('applicants').findOne({
      applicantId
    });

    if (!applicant || applicant.password !== password) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      hasAttempted: applicant.hasAttempted || false,
      role: applicant.role
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { message: 'Authentication failed' },
      { status: 500 }
    );
  }
}