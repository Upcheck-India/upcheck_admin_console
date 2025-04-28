import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

export async function POST(req) {
  try {
    const { applicantId } = await req.json();
    
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Get applicant info
    const applicant = await db.collection('applicants').findOne({ applicantId });
    if (!applicant) {
      return NextResponse.json(
        { message: 'Applicant not found' },
        { status: 404 }
      );
    }
    
    // Update applicant status to revoked
    await db.collection('applicants').updateOne(
      { applicantId },
      { $set: { status: 'revoked', hasAttempted: false } }
    );
    
    return NextResponse.json({
      success: true,
      message: 'Test revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking test:', error);
    return NextResponse.json(
      { message: 'Failed to revoke test' },
      { status: 500 }
    );
  }
}