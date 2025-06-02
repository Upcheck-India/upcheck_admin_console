// src/middleware.js
import { NextResponse } from 'next/server'

export function middleware(request) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const isPublicPath = path === '/login' || path === '/'
  
  // Define recruitment test taking paths that are accessible to candidates
  const isRecruitmentTestPath = path.startsWith('/recruitment/take/') || path.startsWith('/recruitment/submissions/')
  
  // Define recruitment admin paths that require admin authentication
  const isRecruitmentAdminPath = path.startsWith('/recruitment') && !isRecruitmentTestPath

  // Get the token from cookies
  const token = request.cookies.get('auth_token')?.value || ''
  
  // Get the candidate token if present (for test taking)
  const candidateToken = request.cookies.get('candidate_token')?.value || ''

  // Redirect authenticated users trying to access login/public pages to dashboard
  if (isPublicPath && token) {
    return NextResponse.redirect(new URL('/console', request.url))
  }

  // Allow candidates with valid candidate_token to access test taking pages
  if (isRecruitmentTestPath && candidateToken) {
    return NextResponse.next()
  }
  
  // Require admin authentication for recruitment admin pages
  if (isRecruitmentAdminPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect unauthenticated users trying to access protected pages to login
  if (!isPublicPath && !isRecruitmentTestPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    // Protected routes
    '/cms/dashboard',
    '/console',
    '/dashboard/:path*',
    '/settings',
    '/settings/:path*',
    '/new-post',
    '/new-post/:path*',
    // Auth routes
    '/login',
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}