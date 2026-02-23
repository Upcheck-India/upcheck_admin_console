import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';

// GET /api/dataroom/external-auth/me - Get current external user session
export async function GET(request) {
  try {
    const token = request.cookies.get('external_user_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('dataroom_external_users').findOne(
      { sessionToken: token },
      { projection: { passwordHash: 0, sessionToken: 0 } }
    );

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Check if session expired
    if (user.sessionExpiry && new Date() > new Date(user.sessionExpiry)) {
      // Clear expired session
      await db.collection('dataroom_external_users').updateOne(
        { _id: user._id },
        { $set: { sessionToken: null, sessionExpiry: null } }
      );
      return NextResponse.json({ authenticated: false, expired: true }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        company: user.company,
        designation: user.designation,
        status: user.status,
      },
      sessionExpiresAt: user.sessionExpiry,
    });

  } catch (error) {
    console.error('GET /api/dataroom/external-auth/me error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
