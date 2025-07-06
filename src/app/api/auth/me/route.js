import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

// GET - Fetches the current logged-in user's data
export async function GET(req) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find user by session token, but exclude sensitive fields from the response
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { password: 0, sessionToken: 0 } } 
    );

    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
  }
}
