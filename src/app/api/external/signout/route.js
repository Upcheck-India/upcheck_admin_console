// src/app/api/external/signout/route.js
// Sign out external (Clerk) user

import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // The actual sign out is handled client-side via Clerk's useClerk hook
    // This endpoint is for any server-side cleanup if needed

    const response = NextResponse.json({
      success: true,
      message: 'Signed out successfully'
    });

    return response;
  } catch (error) {
    console.error('External signout error:', error);
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}
