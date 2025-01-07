// src/app/api/auth/route.js
//updated for lastLogin
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import clientPromise from "../../../lib/mongodb";

export async function POST(req) {
  try {
    const client = await clientPromise;
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const db = client.db("resources");
    
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    const user = await db.collection('admin_users').findOne({ 
      username, 
      password: hashedPassword 
    });

    if (user) {
      // Update last login timestamp
      await db.collection('admin_users').updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } }
      );

      // Generate session token
      const sessionToken = crypto.randomBytes(32).toString('hex');

      // Create the cookie with strict settings
      cookies().set('admin_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7200, // 2 hours
        path: '/',
      });

      return NextResponse.json({
        success: true,
        user: {
          username: user.username,
          role: user.role,
          perms: user.perms
        }
      });
    }

    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}