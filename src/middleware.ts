import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/dataroom/external/login(.*)',
  '/dataroom/external/register(.*)',
  '/login(.*)',
  '/register(.*)',
  '/api/auth(.*)',
  '/api/clerk/webhook(.*)', // Clerk webhook endpoint
])

// Routes protected by Clerk (external user routes)
const isClerkRoute = createRouteMatcher([
  '/dataroom/external(.*)',
])

// Internal admin/staff routes (protected by admin_token cookie)
const isAdminRoute = createRouteMatcher([
  '/console(.*)',
  '/console-admin(.*)',
  '/api/admin(.*)',
  '/api/documentation(.*)',
  '/documentation(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Extract token from Authorization header if present (for mobile app)
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    req.cookies.set('admin_token', token);
    
    // Also inject it into the raw Cookie header for compatibility with Next.js cookies() API
    const existingCookie = req.headers.get('cookie') || '';
    const newCookie = `admin_token=${token}${existingCookie ? `; ${existingCookie}` : ''}`;
    req.headers.set('cookie', newCookie);
  }

  const { userId: clerkUserId } = await auth()
  const hasAdminToken = req.cookies.has('admin_token')

  // Handle root path - redirect based on session type
  if (req.nextUrl.pathname === '/') {
    if (clerkUserId) {
      return NextResponse.redirect(new URL('/dataroom/external/dashboard', req.url))
    }
    if (hasAdminToken) {
      return NextResponse.redirect(new URL('/console', req.url))
    }
    return NextResponse.next()
  }

  // Allow public routes without authentication
  if (isPublicRoute(req)) {
    // If user has Clerk session but trying to access internal login,
    // redirect them to external dashboard
    if (clerkUserId && req.nextUrl.pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/dataroom/external/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // Handle Clerk routes (external users)
  if (isClerkRoute(req)) {
    // Block access if user has admin token (internal session)
    if (hasAdminToken) {
      return NextResponse.redirect(new URL('/console', req.url))
    }

    // Require Clerk authentication for external routes
    if (!clerkUserId) {
      return NextResponse.redirect(new URL('/dataroom/external/login', req.url))
    }
    return NextResponse.next()
  }

  // Handle internal admin/staff routes
  if (isAdminRoute(req)) {
    // Block access if user has Clerk session (external user)
    if (clerkUserId) {
      return NextResponse.redirect(new URL('/dataroom/external/dashboard', req.url))
    }

    // Require admin token for internal routes
    if (!hasAdminToken) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Other routes - allow with no special protection
  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
