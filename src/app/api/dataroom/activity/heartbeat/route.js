import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      const externalToken = request.cookies.get('external_user_token')?.value;
      if (!externalToken) return null;
      
      const client = await clientPromise;
      const db = client.db('resources');
      const externalUser = await db.collection('dataroom_external_users').findOne(
        { sessionToken: externalToken },
        { projection: { _id: 1, email: 1, name: 1, role: 1 } }
      );
      
      if (externalUser) {
        return {
          ...externalUser,
          username: externalUser.name,
          isExternal: true,
        };
      }
      return null;
    }
    
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user ? { ...user, isExternal: false } : null;
  } catch {
    return null;
  }
}

function parseUserAgent(userAgent) {
  const ua = userAgent || '';
  
  // Detect device type
  let device = 'desktop';
  if (/mobile/i.test(ua)) device = 'mobile';
  else if (/tablet|ipad/i.test(ua)) device = 'tablet';
  
  // Detect browser
  let browser = 'Unknown';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  
  // Detect OS
  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/ios|iphone|ipad/i.test(ua)) os = 'iOS';
  
  return { device, browser, os };
}

function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || real || 'unknown';
}

async function getLocationFromIP(ip) {
  // Free IP geolocation with fallback
  if (ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('192.168.')) {
    return { city: 'Unknown', country: 'Unknown', failed: true };
  }

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=city,country`, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        city: data.city || 'Unknown',
        country: data.country || 'Unknown',
        failed: false,
      };
    }
  } catch (error) {
    // Silently fail and return unknown location
  }
  
  return { city: 'Unknown', country: 'Unknown', failed: true };
}

// POST /api/dataroom/activity/heartbeat - Record user activity heartbeat
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { documentId, roomId, action = 'viewing' } = body;

    if (!documentId || !ObjectId.isValid(documentId)) {
      return NextResponse.json({ error: 'Valid documentId is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Parse request info
    const userAgent = request.headers.get('user-agent');
    const { device, browser, os } = parseUserAgent(userAgent);
    const ipAddress = getClientIP(request);
    const location = await getLocationFromIP(ipAddress);

    // Record activity in heartbeat collection
    await db.collection('dataroom_activity_heartbeat').insertOne({
      userId: user._id.toString(),
      userEmail: user.email,
      userName: user.username || user.name,
      isExternal: user.isExternal || false,
      documentId: new ObjectId(documentId),
      roomId: roomId ? new ObjectId(roomId) : null,
      action,
      device,
      browser,
      os,
      ipAddress,
      location: {
        city: location.city,
        country: location.country,
      },
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Auto-expire after 10 minutes
    });

    // Create TTL index if not exists
    try {
      await db.collection('dataroom_activity_heartbeat').createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 }
      );
    } catch (e) {
      // Index might already exist
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('POST /api/dataroom/activity/heartbeat error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
