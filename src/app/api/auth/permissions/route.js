// src/app/api/auth/permissions/route.js
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'No token found' },
        { status: 401 }
      );
    }

    // Connect to MongoDB and verify token
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find user by token (you might want to store tokens in a separate collection)
    const user = await db.collection('admin_users').findOne(
      {}, // Replace with token verification logic
      { projection: { perms: 1, username: 1 } }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      permissions: user.perms || []
    });

  } catch (error) {
    console.error('Permissions check error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}