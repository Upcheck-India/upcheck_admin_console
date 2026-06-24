import { getAuthUser } from '../../../../lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        { authenticated: false, message: 'No token found' },
        { status: 401 }
      );
    }

    const { user } = auth;

    // Return user data along with authentication status
    return NextResponse.json(
      { 
        authenticated: true,
        user: {
          id: user._id?.toString(),
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role || 'user', // Default role if not specified
          messagingId: user.messagingId || null,
          messagingPrivacy: user.messagingPrivacy || 'none',
          messageNotificationsEnabled: user.messageNotificationsEnabled !== false,
        }
      },
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