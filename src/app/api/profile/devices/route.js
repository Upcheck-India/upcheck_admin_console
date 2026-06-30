import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

// Get active sessions for the current user
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    // Get current token from cookies or Authorization header
    let currentToken = null;
    const cookieStore = request.cookies;
    if (cookieStore && typeof cookieStore.get === 'function') {
      currentToken = cookieStore.get('admin_token')?.value;
    }
    if (!currentToken) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        currentToken = authHeader.substring(7).trim();
      }
    }

    // Fetch active sessions from DB
    const sessions = await db.collection('admin_sessions')
      .find({ userId: user._id })
      .sort({ lastUsedAt: -1 }) // most recent first
      .toArray();

    const enrichedSessions = sessions.map(session => ({
      id: session.token, // Map id to token so frontend delete calls send token as deviceId
      name: session.name || 'Unknown Device',
      deviceType: session.deviceType || 'unknown',
      addedAt: session.createdAt || new Date(),
      lastUsed: session.lastUsedAt || new Date(),
      ip: session.ip || 'unknown',
      location: session.location || 'Unknown Location',
      isCurrent: session.token === currentToken,
      userAgent: session.userAgent || ''
    }));

    return NextResponse.json({
      success: true,
      devices: enrichedSessions, // For Web Console
      trustedDevices: enrichedSessions, // For Mobile App
      maxConcurrentSessions: user.maxConcurrentSessions || 1,
      emailAlertsOnNewLogin: user.emailAlertsOnNewLogin !== false
    });
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update security/session settings
export async function PUT(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    const body = await request.json();
    const { maxConcurrentSessions, emailAlertsOnNewLogin } = body;

    const updateFields = {};
    
    if (maxConcurrentSessions !== undefined) {
      const val = parseInt(maxConcurrentSessions, 10);
      if ([1, 2, 999].includes(val)) {
        updateFields.maxConcurrentSessions = val;
      } else {
        return NextResponse.json({ error: 'Invalid concurrent sessions value' }, { status: 400 });
      }
    }

    if (emailAlertsOnNewLogin !== undefined) {
      updateFields.emailAlertsOnNewLogin = !!emailAlertsOnNewLogin;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No valid settings to update' }, { status: 400 });
    }

    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { $set: updateFields }
    );

    return NextResponse.json({
      success: true,
      message: 'Security settings updated successfully',
      settings: updateFields
    });
  } catch (error) {
    console.error('Error updating security settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Revoke a session
export async function DELETE(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    const body = await request.json();
    const { deviceId, revokeAllOthers } = body;

    if (revokeAllOthers) {
      // Get current token from cookies or Authorization header
      let currentToken = null;
      const cookieStore = request.cookies;
      if (cookieStore && typeof cookieStore.get === 'function') {
        currentToken = cookieStore.get('admin_token')?.value;
      }
      if (!currentToken) {
        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          currentToken = authHeader.substring(7).trim();
        }
      }

      if (!currentToken) {
        return NextResponse.json({ error: 'Current session token not found' }, { status: 400 });
      }

      // Delete all sessions for this user EXCEPT the current one
      await db.collection('admin_sessions').deleteMany({
        userId: user._id,
        token: { $ne: currentToken }
      });

      // Keep only current token in user's array
      await db.collection('admin_users').updateOne(
        { _id: user._id },
        { $set: { sessionToken: [currentToken] } }
      );

      return NextResponse.json({
        success: true,
        message: 'All other active sessions revoked successfully'
      });
    }

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID (session token) is required' }, { status: 400 });
    }

    // Find the session to remove
    const session = await db.collection('admin_sessions').findOne({
      userId: user._id,
      token: deviceId
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Delete session from DB
    await db.collection('admin_sessions').deleteOne({ _id: session._id });

    // Pull token from user document
    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { $pull: { sessionToken: deviceId } }
    );

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
      removedDevice: {
        id: deviceId
      }
    });
  } catch (error) {
    console.error('Error revoking session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}