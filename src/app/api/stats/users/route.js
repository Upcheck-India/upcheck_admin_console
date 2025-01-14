// src/app/api/stats/users/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Get counts from both collections
    const [usersCount, postsCount] = await Promise.all([
      db.collection('admin_users').countDocuments(),
      db.collection('web').countDocuments()
    ]);
    
    return NextResponse.json({
      usersCount,
      postsCount,
      success: true
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}