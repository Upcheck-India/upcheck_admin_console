import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

export async function GET(request) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('users').findOne({
      email: request.cookies.get('user_email')?.value
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      enabled: user.twoFactorAuth?.enabled || false,
      mode: user.twoFactorAuth?.mode || 'untrusted', // 'all' or 'untrusted'
      hasTrustedDevices: user.trustedDevices && user.trustedDevices.length > 0
    });
  } catch (error) {
    console.error('Error fetching 2FA settings:', error);
    return NextResponse.json({ error: 'Failed to fetch 2FA settings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const { action, password, mode } = await request.json();

    // Verify password (implement proper password verification here)
    const user = await db.collection('users').findOne({
      email: request.cookies.get('user_email')?.value
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Password verification logic here
    if (!user || !user.password || !password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Check if user has trusted devices when enabling
    if (action === 'enable' && (!user.trustedDevices || user.trustedDevices.length === 0)) {
      return NextResponse.json({ error: 'At least one trusted device is required to enable 2FA' }, { status: 400 });
    }

    const update = {
      twoFactorAuth: {
        enabled: action === 'enable',
        mode: mode || 'untrusted'
      }
    };

    await db.collection('users').updateOne(
      { email: user.email },
      { $set: update }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating 2FA settings:', error);
    return NextResponse.json({ error: 'Failed to update 2FA settings' }, { status: 500 });
  }
}
