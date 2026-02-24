import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';

// POST /api/dataroom/external-auth/verify-email - Verify email with code
export async function POST(request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and verification code are required' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    const codeStr = code.toString().trim();

    const client = await clientPromise;
    const db = client.db('resources');

    // Find user with matching email and code
    const user = await db.collection('dataroom_external_users').findOne({
      email: emailLower,
      verificationCode: codeStr,
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Check if code has expired
    if (user.verificationCodeExpiry && new Date() > new Date(user.verificationCodeExpiry)) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    // Update user - mark email as verified and status as pending approval
    await db.collection('dataroom_external_users').updateOne(
      { email: emailLower },
      {
        $set: {
          emailVerified: true,
          status: 'pending_approval',
          verificationCode: null,
          verificationCodeExpiry: null,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully. Your account is now pending admin approval.',
    });

  } catch (error) {
    console.error('POST /api/dataroom/external-auth/verify-email error:', error);
    return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 });
  }
}
