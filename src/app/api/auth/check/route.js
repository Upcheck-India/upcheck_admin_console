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
      { sessionToken: token }, // Match the session token
      { 
        projection: { 
          username: 1, 
          role: 1,
          email: 1,
          name: 1,
          messagingId: 1,
        } 
      }
    );
    
    if (!user) {
      return NextResponse.json(
        { authenticated: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    // Return user data along with authentication status
    return NextResponse.json(
      { 
        authenticated: true,
        user: {
          id: user._id?.toString(),
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role || 'user', // Default role if not specified
          messagingId: user.messagingId || null,
        }
      },
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