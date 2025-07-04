import { cookies, headers } from 'next/headers';
import { ObjectId } from 'mongodb';
import { jwtVerify, SignJWT } from 'jose';
import { NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');
const SESSION_COOKIE = 'session_token';

export async function createSession(user) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await new SignJWT({ 
    user: { 
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role
    } 
  })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('7d')
  .sign(JWT_SECRET);

  cookies().set({
    name: SESSION_COOKIE,
    value: session,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path: '/',
  });

  return session;
}

export async function getSession(request) {
  // If called from API route with request object
  if (request?.cookies) {
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (!session) return null;
    
    try {
      const { payload } = await jwtVerify(session, JWT_SECRET);
      return payload;
    } catch (error) {
      console.error('Session verification failed:', error);
      return null;
    }
  } 
  // If called from server component
  else {
    const session = cookies().get(SESSION_COOKIE)?.value;
    if (!session) return null;
    
    try {
      const { payload } = await jwtVerify(session, JWT_SECRET);
      return payload;
    } catch (error) {
      console.error('Session verification failed:', error);
      return null;
    }
  }
}

export async function updateSession(updates) {
  const session = await getSession();
  if (!session) return null;

  const updatedSession = {
    ...session,
    user: {
      ...session.user,
      ...updates
    }
  };

  return await createSession(updatedSession.user);
}

export async function deleteSession() {
  cookies().delete(SESSION_COOKIE);
}

// Helper to get user ID from session
// This is used in API routes where we just need the user ID
export async function getUserId() {
  const session = await getSession();
  return session?.user?.id ? new ObjectId(session.user.id) : null;
}

// Middleware for protecting API routes
export async function requireAuth(handler) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handler();
}
