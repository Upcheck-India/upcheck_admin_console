// src/middleware.js
import { NextResponse } from 'next/server';

// Define protected routes that require authentication
const protectedRoutes = ['/dashboard', '/settings', '/new-post'];
const authRoutes = ['/login'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Get the token from cookies
  const token = request.cookies.get('admin_token')?.value;

  // Check if the current path is a protected route (exact match or starts with)
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  
  // Check if the current path is an auth route (login page)
  const isAuthRoute = authRoutes.some(route => pathname === route);

  // Handle protected routes
  if (isProtectedRoute) {
    if (!token) {
      // No token found, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    try {
      // Verify token here if needed
      // For now, we'll just check if it exists
      return NextResponse.next();
    } catch (error) {
      // Invalid token, redirect to login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Handle auth routes (login page)
  if (isAuthRoute) {
    if (token) {
      // User is already authenticated, redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // Allow access to login page for non-authenticated users
    return NextResponse.next();
  }

  // For all other routes, continue normally
  return NextResponse.next();
}

export const config = {
  // Update matcher to include all variations of protected routes
  matcher: [
    // Protected routes
    '/dashboard',
    '/dashboard/:path*',
    '/settings',
    '/settings/:path*',
    '/new-post',
    '/new-post/:path*',
    // Auth routes
    '/login'
  ]
};