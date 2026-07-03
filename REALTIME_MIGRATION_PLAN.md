# Real-Time Migration Plan: Presence, Messaging, Typing, Notifications

Status: proposed, not started. This document is the implementation brief — start work directly from Phase 0.

## 1. Why this document exists

Today, presence, messaging, typing indicators, and in-app notifications across
the web console (`upcheck_admin`) and the mobile app (`upcheck_erp_app`) are
all built on client-side `setInterval` polling against REST endpoints, hitting
MongoDB on every tick whether or not anything changed. This works but:

- Wastes DB/API capacity linearly with concurrent open chats (every open chat
  window/screen re-queries every 2-5s, forever, per user).
- Has inherent latency equal to the poll interval (2-5s best case).
- Requires the "mark as read" and "who's typing" side effects to happen as a
  side effect of a GET request, which is fragile (see the blue-tick and
  duplicate-message bugs already fixed in this codebase — both were poll
  reconciliation bugs).
- Cannot push updates to a screen that isn't actively polling (e.g. list
  screens showing unread counts only refresh on their own separate timers).

This plan introduces a real-time transport (Socket.IO over MongoDB Change
Streams) as the default path for messaging, typing, and presence, while
**keeping every existing polling endpoint untouched** as a per-module,
per-user selectable fallback. Nothing described here requires ripping out the
current code — it is additive.

## 2. Current-state findings (grounds the design)

Confirmed by direct repo inspection:

- **Deployment**: `upcheck_admin` has no `server.js`, no `Dockerfile`, no PM2
  config, and a stock `create-next-app` README pointing at Vercel. Treat this
  as **serverless until proven otherwise** — a real-time server **cannot**
  live inside the Next.js API routes themselves; it must be a separate
  persistent process. Action item in Phase 0: confirm with whoever manages
  hosting whether this is actually Vercel or a VPS running `next start`. The
  plan below works either way, because it doesn't depend on the Next.js
  process being long-lived.
- **`socket.io` (`^4.8.1`) and `ws` (`^8.18.3`) are already listed in
  `upcheck_admin/package.json`** but are never imported or instantiated
  anywhere in the codebase (`socket/mongodb.js` is a dead duplicate of
  `src/lib/mongodb.js`, not a socket namespace). These are leftover from an
  earlier, abandoned attempt — safe to reuse or safe to remove and re-add
  pinned versions; either way, zero new licensing/legal work.
- **MongoDB is Atlas** (`mongodb+srv://` in `.env.local`), which means it is
  a replica set by default — **Change Streams work with zero infrastructure
  change**, including on the free M0 tier. This is the single most important
  fact behind the architecture recommendation in §4.
- **`upcheck_meetings_bot`** is a separate, already-deployed, persistent
  Node/Express process (`node src/server.js`, not serverless) — proof that
  this team already operates non-Vercel Node hosting for backend concerns.
  It is not a good place to add a socket server (it runs Playwright/headless
  Chromium for meeting bots — different resource profile, different failure
  domain), but it establishes that adding one more small persistent service
  is an already-solved operational problem, not a new one.
- **The web console duplicates the same polling pattern as the app**:
  `src/app/messages/page.js` (5s), `src/app/messages/[conversationId]/page.js`
  (5s), `src/app/messages/team/[teamId]/page.js` (4s), and
  `src/app/project_management/[id]/ProjectChat.js` (3s messages + 3s typing)
  all run their own independent `setInterval` against `/api/chat/poll`,
  `/api/team-chat/poll`, and a project-chat equivalent. Any real-time work
  must cover the web console, not just the app — this plan does both from
  the start rather than as a follow-up.
- **Presence today**: `admin_users.lastActive` is bumped as a side effect of
  polling (e.g. `team-chat/poll/route.js`), and both the app
  (`hooks/useOnlineUsers.ts`, 15s) and presumably console equivalents poll
  `/api/online-users` to read it back. This is the least accurate part of the
  current system (a user reads as "online" for up to 15-19s after actually
  going offline) and the easiest to fix first — sockets give you *exact*
  connect/disconnect events for free.
- **Typing indicators**: Group and Team chat already have a DB-backed,
  poll-driven implementation (`group_typing`/`team_typing` collections,
  5s TTL); DM typing was added in this session using the same pattern
  (`dm_typing`). All three are straightforward to replace with a pure
  in-memory socket broadcast (no DB write needed at all in real-time mode).
- **Messages already carry everything needed for real-time fan-out**:
  `conversationId`/`teamId`/`groupId`, a `clientId` idempotency key (added
  this session for team chat dedupe), and consistent `readBy`/`status`
  fields. No schema migration is required to start emitting change events —
  Change Streams read the existing collections as-is.

## 3. Design principles

1. **Additive, not a rewrite.** Every existing REST/poll endpoint stays
   exactly as it is today and continues to work as the fallback path.
2. **One source of truth.** MongoDB stays the source of truth for messages,
   read receipts, and admin notifications. The real-time layer is a delivery
   mechanism on top, not a second copy of the data. This is what makes
   "keep polling as an alternative" cheap: both paths read the same rows,
   so there's no dual-write consistency problem to solve.
3. **Typing and raw presence are the one exception** — they are ephemeral by
   nature and, in real-time mode, never need to touch MongoDB at all
   (broadcast directly over sockets). The existing DB-backed
   `*_typing` collections and `lastActive` field remain exactly as they are
   today, purely for the polling fallback.
4. **Per-module, per-user selectable**, not global. A user can run messaging
   in real-time mode while keeping notifications on polling, etc. Default
   should be realtime-on for all modules once each phase ships, with an
   automatic, silent fallback to polling if the socket can't connect —
   the manual setting is an override for that default, not the only way
   polling ever gets used.
5. **Authorization parity.** Every socket room a client joins must pass the
   same membership check the equivalent poll endpoint already does
   (participant of conversation / member of team / member of group). Do not
   trust client-supplied room names.

## 4. Target architecture

```
                     ┌──────────────────────────┐
                     │   upcheck_realtime        │  (new, standalone Node process)
                     │   Socket.IO server        │
                     │                            │
   Web console ─────►│  - auth via short-lived    │
   (browser)         │    JWT (see §6)            │
                     │  - room membership checks  │
   Mobile app  ─────►│    against MongoDB         │
   (socket.io-client)│  - MongoDB Change Stream   │◄──── watches
                     │    listeners fan out to    │      chat_messages,
                     │    the right rooms         │      team_messages,
                     │  - presence tracked purely │      group_chat_messages,
                     │    in-memory (or Redis if  │      admin_notifications,
                     │    scaled >1 instance)     │      meetings/events
                     │  - typing relayed directly,│
                     │    no DB write             │
                     └────────────┬───────────────┘
                                  │ reads (no writes)
                                  ▼
                     ┌──────────────────────────┐
                     │   MongoDB Atlas            │◄──── writes, as today,
                     │   (existing cluster,       │      from upcheck_admin's
                     │    replica set already)    │      Next.js API routes
                     └──────────────────────────┘      (chat/send, team-chat/
                                                         messages, etc — UNCHANGED)
```

Key point: **the realtime server never receives writes directly from
clients.** A client sends a message the same way it does today — HTTP POST to
`upcheck_admin`'s existing `/api/chat/send` etc. That write lands in MongoDB.
The Change Stream on `upcheck_realtime` observes the insert and pushes it down
every open socket in the right room, instantly. This means:

- Zero changes to send/read/mute/block business logic already in
  `src/app/api/**`.
- The realtime server is small, stateless (aside from the in-memory socket
  registry), and disposable — if it crashes or is redeployed, no data is at
  risk; clients just silently fall back to polling until it's back.
- Multi-device push-token work already done (per-user array of tokens) maps
  directly onto multi-socket-per-user tracking.

### Why Socket.IO over raw `ws`, SSE, or a managed service (Pusher/Ably)

| Option | Verdict |
|---|---|
| **Socket.IO** (recommended) | Already an unused dependency in the repo. Built-in room support (maps 1:1 onto conversation/team/group), automatic reconnection with backoff, transport fallback (polling transport if WebSocket is blocked by a corporate proxy — ironically useful given this is an enterprise ERP app), and a mature RN client. |
| Raw `ws` | More boilerplate for rooms/reconnection/heartbeats that Socket.IO gives for free; no real advantage here since we're not latency-shaving at a scale that matters yet. |
| SSE (Server-Sent Events) | One-directional (server→client only); typing indicators need client→server too, so you'd still need a second channel for that. Skip. |
| Managed service (Pusher/Ably/Supabase Realtime) | Removes the "operate a Node process" concern entirely and would work even if hosting is confirmed Vercel-only. Real tradeoff: recurring cost, another vendor, and less control over room-membership auth (would need webhook-based auth checks). **Fallback recommendation if Phase 0 confirms Vercel-only hosting with no appetite to run a second Node service anywhere** — see §9.

Recommendation: build on Socket.IO + a small self-hosted Node service. Fall
back to a managed service only if Phase 0 rules out running any additional
persistent process.

## 5. Data model additions

No changes to existing collections. Two additions:

1. **`user_preferences` collection** (new):
   ```js
   {
     userId: string,          // matches admin_users._id.toString()
     realtime: {
       messaging: 'realtime' | 'polling',   // default 'realtime'
       typing:    'realtime' | 'polling',   // default 'realtime'
       presence:  'realtime' | 'polling',   // default 'realtime'
       notifications: 'realtime' | 'polling', // default 'realtime'
     },
     updatedAt: Date
   }
   ```
   One document per user, upserted. Read by both the web console settings
   page and the app's Preferences tab (same collection, same API — see §7).

2. **Nothing added to `admin_users`, `chat_messages`, `team_messages`,
   `group_chat_messages`, or `admin_notifications`.** Change Streams operate
   on the existing shape.

## 6. Auth for socket connections

Do not reuse the long-lived `sessionToken` directly as a socket auth
credential (it would mean the realtime server needs MongoDB read access on
every single reconnect, and leaks a long-lived secret into a process with a
different blast radius than the main API).

Add one new endpoint to `upcheck_admin`:

- **`POST /api/realtime/token`** — authenticated the same way every other API
  route is (session cookie or Bearer token), returns a short-lived (5-10 min)
  signed JWT containing `{ userId, exp }`. Reuse whatever JWT signing you
  already have available (`jsonwebtoken` is a common transitive dep already;
  confirm/add explicitly).
- Client (web + app) fetches this token before connecting, passes it as
  `io(url, { auth: { token } })`, and refreshes it proactively (e.g. every 4
  minutes) or on reconnect.
- `upcheck_realtime` verifies the JWT signature and expiry locally — **no
  DB round-trip needed to authenticate a socket connection.**
- On `join` events (e.g. `socket.emit('join:conversation', conversationId)`),
  the realtime server does need one MongoDB read to confirm membership
  (mirroring the exact check already in `chat/poll/route.js` /
  `group-chats/poll/route.js` / `team-chat/poll/route.js`). Cache this
  membership check in-memory for the life of the socket connection to avoid
  re-checking on every message.

## 7. API changes (`upcheck_admin`)

New, additive endpoints only:

- `POST /api/realtime/token` — mint short-lived socket JWT (§6).
- `GET /api/settings/realtime-preferences` — returns the caller's
  `user_preferences.realtime` (defaulting all four modules to `'realtime'`
  if no document exists yet).
- `PUT /api/settings/realtime-preferences` — upserts it. Body:
  `{ messaging?, typing?, presence?, notifications? }` (partial update).

No changes to `chat/send`, `team-chat/messages`, `group-chats/[id]/messages`,
`chat/poll`, `team-chat/poll`, `group-chats/poll`, `chat/read-all`,
`chat/mute`, `chat/revoke`, or any meeting/notification route. They keep
working exactly as today for polling-mode clients, and keep being the only
write path even for realtime-mode clients.

## 8. New service: `upcheck_realtime`

New sibling repo/folder (recommend `upcheck_realtime`, alongside
`upcheck_admin`, `upcheck_erp_app`, `upcheck_meetings_bot`), same
operational shape as `upcheck_meetings_bot` (small Express + a persistent
process, `node src/server.js`).

```
upcheck_realtime/
  src/
    server.js            # http server + Socket.IO attach + healthcheck route
    auth.js              # verify short-lived JWT from /api/realtime/token
    rooms.js             # room-join handlers + membership checks (reads MongoDB)
    presence.js          # in-memory userId -> Set<socketId>, connect/disconnect
    changeStreams/
      messages.js        # watches chat_messages, team_messages, group_chat_messages
      notifications.js   # watches admin_notifications
      meetings.js        # watches meetings/events collections used for reminders/postpone
    typing.js            # pure in-memory relay, no DB
  package.json
```

Responsibilities, precisely scoped:

- **Auth & rooms**: verify JWT, then handle `join:dm:{conversationId}`,
  `join:team:{teamId}`, `join:group:{groamId}` events, each checking
  membership once (same query shape as the existing poll routes) before
  calling `socket.join(...)`.
- **Message fan-out**: three Change Stream watchers (one per collection) that
  on `insert`/`update` look up the room (`conversationId`/`teamId`/`groupId`
  is already on the document) and `io.to(room).emit('message:new'|'message:updated', doc)`.
  This single mechanism replaces DM/team/group poll for realtime clients —
  it is also what fixes the two poll-reconciliation bugs already patched
  this session (blue-tick staleness, team dedupe) *for realtime clients*
  by construction, since there's no "since timestamp" cursor to get stale.
- **Typing**: `socket.on('typing:start', {room}) -> io.to(room).except(socket.id).emit('typing:update', {...})`,
  auto-expire per-socket after ~3s of inactivity server-side (mirrors the
  5s TTL polling clients see today). No MongoDB access.
- **Presence**: on connect, add to in-memory map, `io.to(<followers or global>).emit('presence:online', userId)`;
  on disconnect (with a short grace window, e.g. 5s, to absorb page
  reloads/app backgrounding blips), emit `presence:offline`. Also
  opportunistically bump `admin_users.lastActive` every ~60s while connected,
  so `/api/online-users` (the polling fallback) stays reasonably accurate too.
- **Notifications**: Change Stream on `admin_notifications` (meeting
  postponed/created/reminders) emits to `user:{userId}` rooms for every
  affected participant. Push notification sending
  (`sendPushNotification` in `upcheck_admin`) is untouched — it's the
  background/killed-app channel and stays exactly as implemented; sockets
  are purely for "app is open right now" delivery, replacing the need to
  poll `/api/admin/notifications` every 15s while foregrounded.
- **Horizontal scaling note (later, not Phase 1)**: if/when this needs more
  than one instance, presence and Socket.IO's own room bookkeping need the
  Redis adapter (`@socket.io/redis-adapter`) — call this out but don't build
  it until there's an actual second instance.

Hosting: same class of host as `upcheck_meetings_bot` — Render, Railway,
Fly.io, or an existing VPS. Needs: outbound access to MongoDB Atlas, one
inbound port for WebSocket upgrade, and the JWT signing secret shared with
`upcheck_admin`.

## 9. Fallback path if hosting is confirmed Vercel-only with no appetite for a second service

If Phase 0 rules out running `upcheck_realtime` at all, swap the transport
for a managed pub/sub service (Ably or Pusher Channels) and keep everything
else in this plan identical:

- `upcheck_admin`'s existing write routes (`chat/send` etc.) additionally
  call the managed service's server SDK to publish an event on the relevant
  channel *after* the MongoDB write succeeds (a few lines added to each send
  route — the only place this alternative touches business logic).
- Clients subscribe to channels directly with the managed service's client
  SDK, authenticated via a short-lived token minted by a
  `POST /api/realtime/token`-equivalent (Ably and Pusher both have this
  exact pattern built in — "auth endpoint").
- Presence: both Ably and Pusher have built-in presence channels, replacing
  §8's in-memory presence map.
- Typing: publish/subscribe on the same channel type, no DB.
- Everything in §5, §7, §10, §11 (preferences, settings UI, rollout phases)
  is unchanged.

This is a strictly smaller engineering effort but has a recurring cost and a
new vendor dependency. Default to the self-hosted plan unless Phase 0 says
otherwise.

## 10. Client changes

### 10.1 `upcheck_erp_app` (Expo/React Native)

- Add `socket.io-client` (not currently a dependency — confirmed absent).
- New `lib/realtime.ts`: owns the single socket connection (connect once,
  reused across screens), token fetch/refresh, and typed
  `on`/`emit`/`joinRoom`/`leaveRoom` helpers. Mirrors the existing
  `hooks/usePushNotifications.ts` module-level-state pattern already used in
  this codebase (`activeConversation` tracking) — same idea, same file
  layout convention.
- `AppState` handling: reconnect the socket when the app returns to
  foreground (RN sockets die when backgrounded); this is standard
  socket.io-client + `AppState.addEventListener('change', ...)` wiring.
- Each of `DMChatRoom.tsx` / `GroupChatRoom.tsx` / `TeamChatRoom.tsx` gains a
  realtime-mode branch: on mount, check `usePreferences()`-style setting
  (extend `PreferencesContext` — already built this session for time format
  — with the four realtime toggles from §5) and either:
  - **realtime**: join the relevant room, listen for `message:new`/`message:updated`,
    push into the same `messages`/`chatMessages` state the existing code
    already uses (so all the rendering, read-receipt, and dedupe logic
    written this session is reused unchanged) — and skip starting the
    `setInterval` poll.
  - **polling**: exactly what exists today, untouched.
  - **automatic fallback**: if the socket fails to connect within ~3s or
    disconnects, transparently start the polling interval as a temporary
    measure and retry the socket connection in the background; stop polling
    once the socket recovers.
- Typing: replace the `handleTyping` HTTP POST (added this session for DM,
  already existing for group/team) with `socket.emit('typing:start', {room})`
  in realtime mode; keep the HTTP POST version for polling mode.
- Presence: `hooks/useOnlineUsers.ts` gains a realtime variant that just
  listens for `presence:online`/`presence:offline` events instead of
  polling `/api/online-users`.
- Notifications: the existing `usePushNotifications.ts` foreground-suppression
  logic (built this session) stays as-is for background/killed-app push;
  add a socket listener for `notification:new` (admin_notifications) that,
  when realtime mode is on, updates in-app notification state instantly
  instead of the `notifications.tsx` screen's 15s poll.

### 10.2 `upcheck_admin` web console

- Add `socket.io-client` to `package.json` (currently unused/absent from the
  actual import graph despite `socket.io`/`ws` server-side deps existing).
- New `src/lib/realtime.js` (or `.ts` if the console mixes TS) mirroring
  §10.1's `lib/realtime.ts` — same token-fetch/reconnect pattern, browser
  version (no `AppState`, but do handle `document.visibilitychange` to avoid
  keeping sockets alive across many idle background tabs at scale — optional
  refinement, not blocking for Phase 1).
- `src/app/messages/page.js`, `src/app/messages/[conversationId]/page.js`,
  `src/app/messages/team/[teamId]/page.js`, and
  `src/app/project_management/[id]/ProjectChat.js` each get the same
  realtime/polling branch described in §10.1, reusing their existing state
  update functions.

### 10.3 Settings UI (both surfaces)

- **App**: extend the "Preferences" tab added to `app/(tabs)/profile.tsx`
  this session (currently just clock format) with four toggles — Messaging,
  Typing, Presence, Notifications — each realtime/polling, calling
  `PUT /api/settings/realtime-preferences`.
- **Web console**: add the same four toggles to whatever the console's
  existing user-settings page is (`src/app/messages/settings` already exists
  as a route — natural home, or a general account-settings page if one
  exists outside `messages/`). Same endpoint.

## 11. Phased rollout

Each phase is independently shippable and safe to pause after — later
phases build on earlier ones but nothing is half-broken if you stop.

| Phase | Scope | Why this order |
|---|---|---|
| **0. Decide & provision** | Confirm hosting model (§2); stand up `upcheck_realtime` skeleton (health check + JWT auth only, no business logic yet); add `POST /api/realtime/token` to `upcheck_admin`; add `socket.io-client` to both clients. | Everything else depends on having a place to connect to and a way to auth. Zero user-visible change yet — safe to deploy immediately. |
| **1. Presence** | Connect/disconnect tracking, `presence:online`/`offline` events, `useOnlineUsers` realtime variant in app + console equivalent. | Lowest risk (presence has no data-integrity concerns — worst case it's briefly wrong, same as today), highest immediately-visible improvement (true live online/offline instead of up-to-15s-stale). Good smoke test for the whole pipe before touching messaging. |
| **2. Typing indicators** | Socket-based typing relay for DM/group/team, both surfaces. Keep the existing `*_typing` collections/polling untouched as fallback. | Ephemeral, no persistence, easy to roll back independently, validates the room-join/membership-check pattern that messaging (Phase 3) will reuse. |
| **3. Messaging** | Change Stream watchers for `chat_messages`/`team_messages`/`group_chat_messages`; client realtime branch in all three chat rooms (app) and the four console pages. Read-receipt updates ride the same `message:updated` event. | The core value. Done after 1-2 so the transport/auth/room plumbing is already proven. |
| **4. In-app notifications** | Change Stream on `admin_notifications`; realtime branch for the app's `notifications.tsx` poll and any console equivalent. Push notifications (background/killed) unchanged. | Lowest urgency of the four modules (push already covers the "app not open" case reasonably well) — do it last. |
| **5. Settings UI** | Per-module toggles in app Preferences tab and console settings, wired to the Phase 0 endpoints. | Can technically ship alongside Phase 1 if you want user-facing control from day one, but functionally independent — do it whenever convenient once at least one module is real. |
| **6. Relax polling intervals + observe** | Once realtime is the default and stable, increase the fallback poll intervals (app: 2s → 15-30s; console: 3-5s → 15-30s) since they're now a safety net, not the primary path. Add basic metrics (connected sockets, reconnect rate, Change Stream lag) to `upcheck_realtime`. | This is where the actual server-load win is realized — don't do it until realtime has been stable for a real user population, since the fallback needs to still feel responsive if it's the one active. |

## 12. Testing & rollback strategy

- Each phase should be testable by manually toggling a single user's
  `user_preferences.realtime.<module>` to `'polling'` and confirming the
  polling path still works exactly as before (regression check) — this is
  the built-in rollback for that user without a deploy.
- Global rollback: if `upcheck_realtime` needs to be taken down entirely,
  clients configured for `'realtime'` mode must degrade to polling
  automatically (the "automatic fallback" behavior in §10.1 is not optional
  polish — it is the rollback mechanism, build it in Phase 0/1, not later).
- Load-test the Change Stream fan-out with a synthetic burst (e.g. 50
  messages/sec into a single conversation) before Phase 3 ships broadly —
  Change Streams have their own latency characteristics under load that are
  worth confirming against Atlas's specific tier.

## 13. Rough effort sizing (for planning, not a commitment)

| Phase | Size |
|---|---|
| 0. Skeleton + auth + client deps | Small — mostly plumbing, 1 new service repo |
| 1. Presence | Small |
| 2. Typing | Small–Medium (2 client surfaces × 3 chat types) |
| 3. Messaging | Medium–Large (the real work: 3 Change Stream watchers, realtime branch in every chat component on both surfaces) |
| 4. Notifications | Small–Medium |
| 5. Settings UI | Small |
| 6. Observability + interval relaxation | Small |

Start at Phase 0 immediately — it has no user-facing risk and unblocks
everything after it.
