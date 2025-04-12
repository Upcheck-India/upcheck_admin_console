//src/app/session/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

export async function GET() {
  try {
    const adminToken = cookies().get('admin_token');
    console.log('Session check - Token exists:', !!adminToken?.value);
    
    if (!adminToken?.value) {
      console.log('No admin token found in cookies');
      return NextResponse.json({ user: null });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    const user = await db.collection('admin_users').findOne(
      { sessionToken: adminToken.value },
      { projection: { password: 0 } }
    );

    console.log('Session check - User found:', !!user, 'Role:', user?.role);

    if (!user) {
      console.log('No user found with provided session token');
      cookies().delete('admin_token');
      return NextResponse.json({ user: null });
    }

    const userData = {
      username: user.username,
      role: user.role,
      perms: user.perms || [],
      _id: user._id.toString()
    };

    console.log('Session valid, returning user data:', userData.username, userData.role);
    return NextResponse.json({ user: userData });

  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ user: null });
  }
}