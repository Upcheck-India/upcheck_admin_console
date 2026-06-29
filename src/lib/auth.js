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
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) return null;
    return { user, db, client };
  } catch (error) {
    console.error('Error authenticating user from DB:', error);
    return null;
  }
}
