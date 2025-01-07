// src/app/api/auth/check/route.js
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";

export async function GET() {
  try {
    const token = cookies().get('admin_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { authenticated: false, message: 'No token found' },
        { status: 401 }
      );
    }

    // Optional: Verify token against database
    const client = await clientPromise;
    const db = client.db("resources");
    
    // You might want to store active sessions in the database
    // const session = await db.collection('sessions').findOne({ token });
    
    // if (!session) {
    //   return NextResponse.json(
    //     { authenticated: false, message: 'Invalid session' },
    //     { status: 401 }
    //   );
    // }

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