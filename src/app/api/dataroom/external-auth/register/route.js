import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../../../../../lib/emailService';

// POST /api/dataroom/external-auth/register - Register external user for data room access
export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      email, 
      password, 
      name, 
      mobileNumber, 
      altEmail, 
      purpose, 
      invitedBy, 
      company,
      designation,
      address
    } = body;

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 });
    }

    // Email validation
    const emailLower = email.toLowerCase().trim();
    
    // Block @upcheck.* emails for external users
    if (emailLower.includes('@upcheck.')) {
      return NextResponse.json({ 
        error: 'Upcheck staff emails are not allowed for external user registration. Please use "Login as Upcheck Staff" instead.' 
      }, { status: 400 });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return NextResponse.json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
      }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Check if email already exists in external users
    const existingUser = await db.collection('dataroom_external_users').findOne({ email: emailLower });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered. Please login instead.' }, { status: 409 });
    }

    // Also check admin_users to prevent duplicate with staff
    const existingAdmin = await db.collection('admin_users').findOne({ email: emailLower });
    if (existingAdmin) {
      return NextResponse.json({ 
        error: 'This email is registered as Upcheck Staff. Please use "Login as Upcheck Staff" instead.' 
      }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create external user with pending_approval status
    const newUser = {
      email: emailLower,
      passwordHash,
      name: name.trim(),
      mobileNumber: mobileNumber?.trim() || null,
      altEmail: altEmail?.trim() || null,
      purpose: purpose?.trim() || null,
      invitedBy: invitedBy?.trim() || null,
      company: company?.trim() || null,
      designation: designation?.trim() || null,
      address: address?.trim() || null,
      role: 'external_viewer', // Default role
      status: 'pending_approval', // Will be activated after admin approval
      emailVerified: false,
      verificationCode,
      verificationCodeExpiry,
      sessionToken: null,
      sessionExpiry: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      loginAttempts: 0,
      lockedUntil: null,
    };

    const result = await db.collection('dataroom_external_users').insertOne(newUser);

    // Send verification email
    try {
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
                <h1>Welcome to Upcheck!</h1>
                <p>Verify Your Email Address</p>
              </div>
              <div class="content">
                <p>Hello ${name.trim()},</p>
                <p>Thank you for registering with Upcheck Data Room. Please use the verification code below to verify your email address:</p>
                
                <div class="code-box">
                  <div class="code">${verificationCode}</div>
                </div>
                
                <div class="warning">
                  <strong>⚠️ Important:</strong> This code will expire in 15 minutes.
                </div>
                
                <p><strong>What happens next?</strong></p>
                <ol>
                  <li>Verify your email with the code above (optional but highly recommended)</li>
                  <li>Your account will be reviewed by our admin team</li>
                  <li>You'll receive an email once your account is approved</li>
                  <li>After approval, you can login and access shared resources</li>
                </ol>
                
                <p>If you didn't create this account, please ignore this email.</p>
                
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
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    // Return success without sensitive data
    return NextResponse.json({
      success: true,
      userId: result.insertedId,
      email: emailLower,
      name: name.trim(),
      requiresVerification: true,
      message: 'Registration successful. Please check your email for verification code.',
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/external-auth/register error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
