import { NextResponse, NextRequest } from 'next/server';

import { GET as connectionsGET } from '../../chat/connections/route';
import { GET as teamsGET } from '../../teams/route';
import { GET as groupChatsGET } from '../../group-chats/route';
import { GET as notificationsGET } from '../../admin/notifications/route';

// GET /api/mobile/badges
//
// One request in place of four. The mobile tab bar polls /chat/connections,
// /teams, /group-chats and /admin/notifications together, purely to sum the
// unread counts on its badges. Over a mobile link to this deployment each of
// those round trips costs the better part of a second and they contend for the
// handful of sockets React Native allows per host, so the badge poll alone was
// a multi-second stall repeating every 10 seconds.
//
// Deliberately NOT a re-implementation of the four handlers' unread logic —
// that logic is intricate (mentions, per-type read receipts, bot rows) and a
// second copy of it would drift. The existing handlers are invoked directly
// instead, concurrently, inside a single function invocation. They each
// authenticate, but that is now an in-process cache hit after the first
// (see lib/auth.js), and it is one network round trip either way.
//
// Every section is independent: one failing section returns null rather than
// failing the whole response, so a broken notifications query cannot blank the
// message badges.
async function section(fn, req) {
  try {
    const res = await fn(req);
    if (!res || res.status >= 400) return null;
    return await res.json();
  } catch (e) {
    console.error('[mobile/badges] section failed:', e?.message || e);
    return null;
  }
}

export async function GET(request) {
  // The notifications handler reads `hours` off its own URL; give it the window
  // the tab bar has always asked for rather than letting it fall back to 24.
  const notifUrl = new URL(request.url);
  notifUrl.searchParams.set('hours', '48');
  const notifRequest = new NextRequest(notifUrl, { headers: request.headers });

  const [connections, teams, groupChats, notifications] = await Promise.all([
    section(connectionsGET, request),
    section(teamsGET, request),
    section(groupChatsGET, request),
    section(notificationsGET, notifRequest),
  ]);

  // Every section unauthorized means the session itself is bad — say so, so the
  // client's 401 handling still works instead of silently showing zeroes.
  if (!connections && !teams && !groupChats && !notifications) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ connections, teams, groupChats, notifications });
}
