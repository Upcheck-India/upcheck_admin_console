// src/app/api/auth/route.js 
import clientPromise from "../../../lib/mongodb";
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const client = await clientPromise;
    const { username, password } = await req.json();
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ username, password });
    
    if (user) {
      cookies().set('admin_token', 'authenticated', { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict'
      });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}