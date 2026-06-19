import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { sendEmail } from '../../../../../lib/emailService';

// POST /api/dataroom/external-auth/send-verification - Send verification code to email
export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();

    const client = await clientPromise;
    const db = client.db('resources');

    // Check if user exists
    const user = await db.collection('dataroom_external_users').findOne({ email: emailLower });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save verification code to database
    await db.collection('dataroom_external_users').updateOne(
      { email: emailLower },
      {
        $set: {
          verificationCode,
          verificationCodeExpiry: expiryTime,
          updatedAt: new Date(),
        }
      }
    );

    // Send email with verification code via centralized email service
    await sendEmail({
      to: emailLower,
      subject: 'Verify Your Email - Upcheck Data Room',
      type: 'verification_code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .code-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verification</h1>
              <p>Welcome to Upcheck Data Room</p>
            </div>
            <div class="content">
              <p>Hello ${user.name},</p>
              <p>Thank you for registering with Upcheck Data Room. Please use the verification code below to verify your email address:</p>
              
              <div class="code-box">
                <div class="code">${verificationCode}</div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This code will expire in 15 minutes.
              </div>
              
              <p>After verifying your email, your account will be submitted for admin approval. You will be notified once your account has been approved.</p>
              
              <p>If you didn't request this verification, please ignore this email.</p>
              
              <p>Best regards,<br>Upcheck Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Upcheck. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      expiresAt: expiryTime,
    });

  } catch (error) {
    console.error('POST /api/dataroom/external-auth/send-verification error:', error);
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
  }
}
