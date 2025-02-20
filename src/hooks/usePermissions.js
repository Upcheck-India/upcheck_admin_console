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

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find user by token in admin_users collection
    const user = await db.collection('admin_users').findOne(
      {}, // Add your token matching logic here
      { projection: { perms: 1, username: 1 } }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If user has no permissions array, return empty array
    const permissions = user.perms || [];

    return NextResponse.json({
      authenticated: true,
      permissions
    });

  } catch (error) {
    console.error('Permissions check error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}