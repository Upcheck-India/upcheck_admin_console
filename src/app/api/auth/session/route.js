import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { user: null },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find user by token (you might want to store tokens in a sessions collection)
    const user = await db.collection('admin_users').findOne(
      { /* query by token */ },
      { projection: { password: 0 } }
    );
    
    if (!user) {
      return NextResponse.json(
        { user: null },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        perms: user.perms
      }
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { user: null },
      { status: 500 }
    );
  }
}