// src/app/api/auth/route.js
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from 'mongodb';

export async function POST(req) {
  try {
    const client = await clientPromise;
    const { username, password } = await req.json();
    console.log('Login attempt for:', username);

    if (!username || !password) {
      console.log('Validation failed: Missing username or password');
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const db = client.db("resources");
    const shaPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    // Find the user by username first
    let user = await db.collection('admin_users').findOne({ 
      username
    });

    if (user) {
      const isBcrypt = user.password && user.password.startsWith('$');
      let isMatch = false;

      if (isBcrypt) {
        // Direct ESM node_modules import workaround
        const bcrypt = (await import('file:///d:/Projects/upcheck_admin/upcheck_admin/node_modules/bcryptjs/index.js')).default;
        isMatch = await bcrypt.compare(password, user.password);
      } else {
        isMatch = (user.password === shaPassword);
      }

      if (!isMatch) {
        user = null; // Deny entry
      }
    }

    if (user && (user.employmentStatus === 'suspended' || user.employmentStatus === 'terminated')) {
      console.log('Login denied: Account is suspended or terminated:', username);
      return NextResponse.json(
        { error: 'Your account is suspended or terminated. Please contact support.' },
        { status: 403 }
      );
    }

    if (user) {
      const sessionToken = crypto.randomBytes(32).toString('hex');
      console.log('Generated session token for user:', user.username);

      // Update user with session token
      await db.collection('admin_users').updateOne(
        { _id: user._id },
        { 
          $set: { 
            sessionToken,
            lastLogin: new Date() 
          } 
        }
      );

      // Set cookie with proper settings
      cookies().set('admin_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
        maxAge: 7200,
        path: '/',
      });

      console.log('Login successful, session established');
      return NextResponse.json({
        success: true,
        user: {
          username: user.username,
          role: user.role,
          perms: user.perms || [],
          _id: user._id.toString()
        }
      });
    }

    console.log('Invalid credentials for user:', username);
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