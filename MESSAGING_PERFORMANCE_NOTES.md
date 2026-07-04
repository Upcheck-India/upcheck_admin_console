# Messaging Performance — Audit & Applied Fixes

_2026-07-04. Reported symptoms: chat list tiles, message pages, message loading, and sending all slow._

## Applied (this pass)

| # | Fix | Where | Expected impact |
|---|-----|-------|-----------------|
| 1 | **Index auth lookups.** `admin_sessions.token`, `admin_users.sessionToken` (sparse). Auth did a COLLSCAN of these on *every* API request (every poll, every send). | `src/lib/mongodb.js` (idempotent, once/process) | **Very high** — systemic per-request tax removed. |
| 3 | **Index team/group/typing/mute collections.** `team_messages`/`group_chat_messages {id,createdAt}` + `clientId`, `dm_typing`/`team_typing`/`group_typing`, `chat_mutes`. None existed; each was scanned on every 2s poll. | `src/lib/mongodb.js` | **High** — poll queries go index-backed. |
| 4 | **Batch team sender resolution.** Replaced `$lookup` with `{ $toString: "$_id" }` (defeats `_id` index → COLLSCAN of `admin_users` per message) with one `$in` query + `userMap`. | `team-chat/messages`, `team-chat/poll` | **High** for active team rooms (~100 scans → 1). |
| 5 | **Unblock DM send.** Fire-and-forget push + slash-command dispatch instead of `await`ing before responding. | `chat/send` | **Medium-high** — send latency no longer includes push round-trip. |
| 6 | **Gate client list polling.** Refresh only the active tab's list; pause while a chat is open; 12s→15s. | app `messages.tsx` | **Medium** — ~3x less background request volume. |

## Deferred (higher risk / bigger change — recommend next)

| # | Fix | Why deferred |
|---|-----|--------------|
| 2 | **Denormalize `lastMessage`/`lastMessageAt`/`unreadCount`** onto `conversations`/`chat_connections`, updated on send + read-marking, so the chat-list tiles become a single indexed `find` instead of two blocking aggregations (`connections/route.js:89-125`) + a bot upsert-on-read. | Dual-write consistency; needs care in send + read paths. Biggest remaining tile win. |
| 2b | Move the **bot upsert off the list-read path** (`connections/route.js:26-36`) into `chat/init`. | Small, do with #2. |
| 7 | **Field projection** on message/tile payloads (currently return full docs). | Low-medium; do opportunistically. |

## Not a problem
`src/lib/mongodb.js` caches the client/mongoose connection (no per-request reconnect). Pooling/cold-start is not a top concern.

## Note on indexes
Index creation is idempotent and runs once per process on Mongo connect. On the first deploy after this change, the initial build of indexes on large existing collections may take a few seconds in the background; subsequent connects are no-ops.
