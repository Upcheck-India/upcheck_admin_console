import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Two session cookies, two audiences, and they are mutually exclusive:
//   admin_token         — internal staff, issued by /api/auth
//   external_user_token — external portal users, issued by
//                         /api/dataroom/external-auth/login
//
// Presence of a cookie is all this layer checks. Whether the token is valid,
// unexpired and belongs to an active account is decided by the route handlers
// (withDataroomAuth for the dataroom API), because only they can reach the
// database. Middleware runs on every matched request; making it hit Mongo
// would put a round-trip in front of every asset and page.

const match = (patterns: RegExp[]) => (req: NextRequest) =>
  patterns.some((p) => p.test(req.nextUrl.pathname))

const isPublicRoute = match([
  /^\/dataroom\/external\/login/,
  /^\/dataroom\/external\/register/,
  /^\/dataroom\/external\/verify/,
  /^\/dataroom\/auth-gate/,
  /^\/login/,
  /^\/register/,
  /^\/api\/auth/,
  /^\/api\/dataroom\/external-auth/,
  // Digital Asset Links / Apple App Site Association — must be servable
  // unauthenticated or the mobile apps cannot verify their domain link.
  /^\/\.well-known/,
])

const isExternalRoute = match([/^\/dataroom\/external/])

const isAdminRoute = match([
  /^\/console/,
  /^\/console-admin/,
  /^\/api\/admin/,
  /^\/api\/documentation/,
  /^\/documentation/,
])

export default function middleware(req: NextRequest) {
  // The mobile app sends its session as a Bearer header rather than a cookie.
  // Promote it to `admin_token` so everything downstream sees one shape.
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim()
    if (token && token !== 'null' && token !== 'undefined') {
      req.cookies.set('admin_token', token)
      const existingCookie = req.headers.get('cookie') || ''
      req.headers.set(
        'cookie',
        `admin_token=${token}${existingCookie ? `; ${existingCookie}` : ''}`,
      )
    }
  }

  const pass = () => NextResponse.next({ request: { headers: req.headers } })

  const hasAdminToken = req.cookies.has('admin_token')
  const hasExternalToken = req.cookies.has('external_user_token')

  if (req.nextUrl.pathname === '/') {
    if (hasAdminToken) return NextResponse.redirect(new URL('/console', req.url))
    if (hasExternalToken) {
      return NextResponse.redirect(new URL('/dataroom/external/dashboard', req.url))
    }
    return pass()
  }

  if (isPublicRoute(req)) {
    if (hasExternalToken && !hasAdminToken && req.nextUrl.pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/dataroom/external/dashboard', req.url))
    }
    return pass()
  }

  if (isExternalRoute(req)) {
    // An internal session wins: staff browsing to the external portal are sent
    // back to the console rather than shown someone else's audience.
    if (hasAdminToken) return NextResponse.redirect(new URL('/console', req.url))
    if (!hasExternalToken) {
      return NextResponse.redirect(new URL('/dataroom/external/login', req.url))
    }
    return pass()
  }

  if (isAdminRoute(req)) {
    if (!hasAdminToken) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
    return pass()
  }

  return pass()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
