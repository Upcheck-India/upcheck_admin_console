// src/app/api/profile/validate-password/route.js
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import clientPromise from "../../../../lib/mongodb";
import { ObjectId } from 'mongodb';

export async function POST(req) {
  try {
    const client = await clientPromise;
    const { password } = await req.json();
    const db = client.db("resources");

    // Get the session token from cookies
    const adminToken = cookies().get('admin_token')?.value;
    if (!adminToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Find user with matching session token
    const user = await db.collection('admin_users').findOne({ 
      sessionToken: adminToken 
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Hash the provided password and compare with stored password
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    if (user.password !== hashedPassword) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Password is valid
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Password validation error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
