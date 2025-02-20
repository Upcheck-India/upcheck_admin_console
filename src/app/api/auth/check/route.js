// src/app/api/auth/check/route.js
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { authenticated: false, message: 'No token found' },
        { status: 401 }
      );
    }

    // Verify token against database
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find user with active session
    const user = await db.collection('admin_users').findOne(
      {}, // Replace with token verification logic
      { projection: { username: 1 } }
    );
    
    if (!user) {
      return NextResponse.json(
        { authenticated: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { authenticated: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { authenticated: false, message: 'Server error' },
      { status: 500 }
    );
  }
}