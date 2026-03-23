// src/app/api/share/[token]/verify-password/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

/**
 * POST /api/share/[token]/verify-password
 * Verify password for a shared resource
 */
export async function POST(req, { params }) {
  try {
    const { token } = params;
    const { password } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get share record
    const share = await db.collection('shared_resources').findOne({ token });

    if (!share) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    // Check if password is required
    if (!share.requirePassword || !share.passwordHash) {
      return NextResponse.json({
        success: true,
        message: 'Password not required for this share',
      });
    }

    // Verify password
    const isPasswordCorrect = await bcrypt.compare(password, share.passwordHash);

    if (!isPasswordCorrect) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }

    // Set a cookie to mark this share as verified
    const cookieStore = cookies();
    const verifiedShares = JSON.parse(cookieStore.get('verified_shares')?.value || '{}');
    verifiedShares[token] = true;

    const response = NextResponse.json({
      success: true,
      message: 'Password verified successfully',
    });

    response.cookies.set('verified_shares', JSON.stringify(verifiedShares), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Share password verify error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
