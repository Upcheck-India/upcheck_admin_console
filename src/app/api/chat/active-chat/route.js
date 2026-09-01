import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { recordActiveChat } from '../../../../lib/activeChatViewers';

// POST /api/chat/active-chat
//
// "This device is currently looking at this conversation" — so a push about a
// message the user is already reading is never sent. See lib/activeChatViewers.js.
//
// The app (lib/activeChatPresence.ts) has been calling this endpoint since the
// feature was written, but it did not exist: every report 404'd and was
// swallowed by the client's best-effort catch, so the server never knew and
// notified regardless. That is the "I get notified about the chat I'm in" bug.
//
// Body: { token, kind: 'dm'|'team'|'group'|null, id: string|null }
// A null kind/id clears the record (left the chat, or backgrounded the app).
export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { token, kind, id } = await request.json();
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }
    if (kind && !['dm', 'team', 'group'].includes(kind)) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }

    // Deliberately NOT verifying that `token` belongs to the caller. The worst
    // a forged token achieves is silencing one notification on someone else's
    // device for two minutes, and the check would cost a lookup on a path the
    // app hits every 45s per open chat. Authentication above is what keeps
    // this from being anonymous.
    await recordActiveChat({
      token,
      userId: auth.user._id.toString(),
      kind: kind || null,
      id: id || null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('active-chat report failed:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
