import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// POST /api/dataroom/external-auth/login - External user login with 7-day session
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();

    const client = await clientPromise;
    const db = client.db('resources');

    // Find user
    const user = await db.collection('dataroom_external_users').findOne({ email: emailLower });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Check if account is locked
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const remainingMinutes = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return NextResponse.json({ 
        error: `Account locked due to too many failed login attempts. Try again in ${remainingMinutes} minutes.` 
      }, { status: 403 });
    }

    // Check if account is inactive
    if (user.status !== 'active') {
      return NextResponse.json({ 
        error: 'Account is inactive. Please contact support.' 
      }, { status: 403 });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      // Increment login attempts
      const newAttempts = (user.loginAttempts || 0) + 1;
      const updateData = {
        loginAttempts: newAttempts,
        updatedAt: new Date(),
      };

      // Lock account if max attempts reached
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      }

      await db.collection('dataroom_external_users').updateOne(
        { _id: user._id },
        { $set: updateData }
      );

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        return NextResponse.json({ 
          error: 'Account locked due to too many failed login attempts. Try again in 30 minutes.' 
        }, { status: 403 });
      }

      return NextResponse.json({ 
        error: `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - newAttempts} attempts remaining.` 
      }, { status: 401 });
    }

    // Successful login - generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionExpiry = new Date(Date.now() + SESSION_DURATION_MS);

    await db.collection('dataroom_external_users').updateOne(
      { _id: user._id },
      { 
        $set: {
          sessionToken,
          sessionExpiry,
          lastLoginAt: new Date(),
          loginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        }
      }
    );

    // Create response with httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        company: user.company,
      },
      message: 'Login successful',
      sessionExpiresAt: sessionExpiry.toISOString(),
    }, { status: 200 });

    // Set httpOnly cookie for 7 days
    response.cookies.set('external_user_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_DURATION_MS / 1000, // 7 days in seconds
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('POST /api/dataroom/external-auth/login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
