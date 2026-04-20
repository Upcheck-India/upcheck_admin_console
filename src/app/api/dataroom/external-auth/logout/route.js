import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';

// POST /api/dataroom/external-auth/logout - Logout external user
export async function POST(request) {
  try {
    const token = request.cookies.get('external_user_token')?.value;

    if (token) {
      const client = await clientPromise;
      const db = client.db('resources');

      // Clear session token in database
      await db.collection('dataroom_external_users').updateOne(
        { sessionToken: token },
        { 
          $set: { 
            sessionToken: null, 
            sessionExpiry: null,
            updatedAt: new Date(),
          } 
        }
      );
    }

    // Clear cookie
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.delete('external_user_token');

    return response;

  } catch (error) {
    console.error('POST /api/dataroom/external-auth/logout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
