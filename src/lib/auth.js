import { cookies } from 'next/headers';
import clientPromise from './mongodb.js';

export async function getAuthUser(req) {
  let token = null;

  // 1. Try direct request cookies first (most reliable for web client dashboard)
  if (req && req.cookies) {
    if (typeof req.cookies.get === 'function') {
      token = req.cookies.get('admin_token')?.value;
    } else if (typeof req.cookies === 'object') {
      token = req.cookies['admin_token'] || req.cookies.admin_token;
    }
  }

  // 2. Try Authorization Bearer header (for mobile app/API clients)
  if (!token && req && typeof req.headers?.get === 'function') {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const parsedToken = authHeader.substring(7).trim();
      if (parsedToken && parsedToken !== 'null' && parsedToken !== 'undefined') {
        token = parsedToken;
      }
    }
  }

  // 3. Try next/headers cookies() as a last resort fallback
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('admin_token')?.value;
    } catch (e) {
      // ignore
    }
  }

  if (!token) return null;
  
  try {
    const client = await clientPromise;
    const db = client.db('resources');
    
    let user = null;
    const session = await db.collection('admin_sessions').findOne({ token });
    
    if (session) {
      user = await db.collection('admin_users').findOne({ _id: session.userId });
      if (user) {
        db.collection('admin_sessions').updateOne(
          { _id: session._id },
          { $set: { lastUsedAt: new Date() } }
        ).catch(err => console.error('Failed to update session lastUsedAt:', err));
      }
    } else {
      // Rollout fallback: check if user has this token in their sessionToken array or field
      user = await db.collection('admin_users').findOne({ sessionToken: token });
      if (user) {
        // Backfill active session record for rollout continuity
        const userAgent = req ? (req.headers?.get('user-agent') || '') : '';
        let os = 'Unknown OS';
        if (/windows/i.test(userAgent)) os = 'Windows';
        else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
        else if (/android/i.test(userAgent)) os = 'Android';
        else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
        else if (/linux/i.test(userAgent)) os = 'Linux';
        
        let browser = 'Unknown Browser';
        if (/edg/i.test(userAgent)) browser = 'Edge';
        else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
        else if (/firefox/i.test(userAgent)) browser = 'Firefox';
        else if (/safari/i.test(userAgent)) browser = 'Safari';
        else if (/expo/i.test(userAgent)) browser = 'Expo App';

        const clientIP = req ? (req.headers?.get('x-forwarded-for')?.split(',')[0].trim() || req.headers?.get('x-real-ip') || '127.0.0.1') : '127.0.0.1';

        await db.collection('admin_sessions').insertOne({
          userId: user._id,
          token,
          ip: clientIP,
          userAgent: userAgent.substring(0, 300),
          deviceType: /mobile|iphone|ipod|android/i.test(userAgent) ? 'mobile' : 'desktop',
          name: `${browser} on ${os}`,
          location: 'Unknown Location',
          createdAt: new Date(),
          lastUsedAt: new Date()
        }).catch(err => console.error('Failed to backfill session:', err));
      }
    }

    if (!user) return null;
    return { user, db, client };
  } catch (error) {
    console.error('Error authenticating user from DB:', error);
    return null;
  }
}
