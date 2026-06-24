import { cookies } from 'next/headers';
import clientPromise from './mongodb.js';

export async function getAuthUser(req) {
  // Support both cookie and Authorization Bearer header
  const authHeader = req ? req.headers.get('authorization') : null;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    try {
      const cookieStore = cookies();
      token = cookieStore.get('admin_token')?.value;
    } catch (e) {
      console.error('Error reading cookies in getAuthUser:', e);
    }
  }
  if (!token) return null;
  
  try {
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    return { user, db, client };
  } catch (error) {
    console.error('Error authenticating user from DB:', error);
    return null;
  }
}
