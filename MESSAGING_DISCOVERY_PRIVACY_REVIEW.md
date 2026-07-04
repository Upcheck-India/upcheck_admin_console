# Messaging: Discovery, Connection Requests & Privacy — Review

_Audit date: 2026-07-04. Scope: DM discovery/requests/privacy/blocking across `upcheck_admin` (API + web console) and `upcheck_erp_app` (mobile). Read-only audit; file:line references are to `upcheck_admin/src` unless noted._

This document describes how the system works today, then flags what is **broken, illogical, a user-facing problem, or a security gap**, with a prioritized fix list at the end.

---

## 1. How it works today

### Discovery
- **Two entry points.** `/api/chat/discover` (`app/api/chat/discover/route.js:13-16`) lists **all** `admin_users` that have a `messagingId`, filtered by each target's `messagingPrivacy` (`:41-50`). `/api/chat/find-user` (`app/api/chat/find-user/route.js:21-24`) resolves a single user by an exact `messagingId` string.
- **Messaging ID.** A crypto-random 24-char hex (`app/api/chat/init/route.js:15`) — 96 bits, not guessable/enumerable. But it is **cosmetic**: both endpoints return the real Mongo `_id` as `id` (`discover:54`, `find-user:40`), and every request/accept/revoke/send keys off that `_id`, not the `messagingId`.
- **No org/tenant scoping.** Discovery spans the entire `admin_users` collection; there is no team/org boundary.

### Connection requests
- **Request creates two docs** (`app/api/chat/request/route.js:102-120`): `{userId:R, peerId:P, status:'pending', initiatedBy:R}` **and** `{userId:P, peerId:R, status:'pending', initiatedBy:R}` — both `pending`, both stamped with the requester.
- **Accept** (`app/api/chat/accept/route.js:18-48`) flips both docs to `accepted`, filtering only on `status:'pending'`.
- **Send gate** (`app/api/chat/send/route.js:57-66`) requires an `accepted` connection doc for `{userId:sender, peerId:recipient}`.

### Privacy
- `/api/chat/privacy` (`app/api/chat/privacy/route.js:11`) accepts `messagingPrivacy ∈ {none, teammates, admins, everyone}` + `notificationsEnabled`. Default is `none` (`discover:42`).

### Blocking / revoke
- `/api/chat/revoke` (`app/api/chat/revoke/route.js:16-32`) sets **both** direction docs to `blocked` (block) or `revoked` (cancel/unfriend) via one `updateMany`.

### Data model
- **`chat_connections`** — two docs per relationship: `{userId, peerId, conversationId, status:'pending'|'accepted'|'blocked'|'revoked', initiatedBy, createdAt, updatedAt}`.
- **`conversations`** — `{_id, participants:[userIdStr, userIdStr], createdAt, lastMessageAt}` (DM-only).

---

## 2. Findings

Severity: 🔴 critical (security/data-loss) · 🟠 major (logic/privacy hole) · 🟡 minor (UX/consistency).

### 🔴 F1 — Requester can self-accept (consent bypass)
`accept/route.js:18-48` filters only on `status:'pending'` and never checks that the caller is the **receiver** (`initiatedBy !== currentUser`). The endpoint is a plain authenticated POST taking `{peerId}`. Any user can call `/api/chat/accept` with their own outgoing request's `peerId`, flip both docs to `accepted`, and then message a person **who never consented**. The mobile UI doesn't expose this (it only shows Accept on incoming rows, `messages.tsx:648,878,896`), but the API does not enforce receiver-only, so it's bypassable at the API layer by any session/Bearer holder.
**Fix:** in accept, require the accepting doc to have `initiatedBy === peerId` (i.e., the *other* party initiated), or explicitly `initiatedBy !== currentUserId`.

### 🔴 F2 — `rotate-id` destroys the peer's data too
`rotate-id/route.js:23-38` `deleteMany`s every conversation the user is in **and all messages in them**, plus all their connection docs, then assigns a new `messagingId`. This wipes the **other party's** shared history, not just the caller's — any user can nuke both sides of every chat they're in. It also **doesn't change the user's `_id`**, which is the durable handle peers actually use, so rotation gives a false sense of un-findability while causing real cross-user data loss.
**Fix:** rotation should only change `messagingId` (and optionally soft-hide the caller); never delete shared conversations/messages. If "delete my chats" is desired, make it an explicit, separate, per-conversation action scoped to the caller.

### 🔴 F3 — Read-after-block IDOR
`messages/route.js:29-36` (and the connections/last-message aggregation) gate reads on **conversation participation only** — no connection-status check. A **blocked or revoked** peer keeps full read access to the entire history and can keep polling it. Blocking stops sending but not reading.
**Fix:** message reads/polls must also require a non-blocked (`accepted`) connection, or explicitly deny when the relationship is `blocked`/`revoked`.

### 🟠 F4 — `find-user` ignores privacy entirely
`find-user/route.js` reads no `messagingPrivacy`. A user set to `none` ("hidden") is still fully resolvable by anyone holding their ID — and the ID is exposed in the discover directory and shown/copyable in-app (`discover:58`). So the "secret capability" model is unsafe, and the privacy setting doesn't actually hide anyone.
**Fix:** apply the same `messagingPrivacy` gate in find-user; treat `messagingId` as non-secret.

### 🟠 F5 — Privacy setting gates almost nothing
`messagingPrivacy` only filters the **discover listing** (`discover:41-50`). It does **not** gate `find-user` (F4) or `/api/chat/request` (neither reads it). So "hidden" users still receive requests from anyone, and there's no real "who can contact me" control.
**Fix:** enforce `messagingPrivacy` in request creation (e.g., `teammates` → only same-team requesters; `none` → no unsolicited requests) so the setting means something.

### 🟠 F6 — Mobile privacy values don't match the backend (silent failure)
Mobile offers `none`/`connections`/`closed` (`upcheck_erp_app/app/(tabs)/messages.tsx:1047-1066`); the backend only accepts `none|teammates|admins|everyone` and **rejects** `connections`/`closed` with 400 (`privacy:12`). Mobile also mislabels `none` as "Open — allow anyone" when the server treats `none` as **hidden**. Net effect: on mobile, changing privacy to anything but `none` **silently fails to save**, and the one value that does save means the opposite of its label. (Web console uses the correct values, `messages/settings/page.js:324-327`.)
**Fix:** align the mobile options + labels with the backend enum; add a server 400 surfacing on the client.

### 🟠 F7 — No working unblock on mobile
Mobile "Unblock" calls `handleAcceptRequest` → `/chat/accept` (`messages.tsx:928`), which only matches `status:'pending'`. Blocked docs are `blocked` → `matchedCount=0` → 404. There is **no working unblock path**.
**Fix:** add an explicit unblock (revoke→delete or set to a neutral state) and wire the button to it.

### 🟡 F8 — Blocking is symmetric and confusing
`revoke` sets **both** docs to `blocked`, so the *blocked* user sees the blocker in their own "Blocked Users" list as though they did the blocking (`messages.tsx:649,915`). There's no notion of "who blocked whom," no notification, and no audit.
**Fix:** track `blockedBy`; only show "Blocked" management to the actor; hide/neutralize on the blocked side.

### 🟡 F9 — Email PII leaked in directory/lookup responses
`email` is returned by discover (`:56`), find-user (`:42`), and connections (`connections/route.js:155`) to any caller. Directory/ID lookups therefore leak email addresses org-wide.
**Fix:** omit `email` from discovery/lookup payloads (return only display name + messagingId + avatar); reveal contact details only after an accepted connection.

### 🟡 F10 — `revoked` allows re-request, `blocked` doesn't (correct, but undocumented)
`request/route.js:33,47` refuses when either side is `blocked` (good) but allows re-request from `revoked`. Reasonable, but the distinction between `revoked` (re-connectable) and `blocked` (not) isn't surfaced anywhere in the UI.

---

## 3. Cross-cutting themes
- **`messagingId` is treated as a secret capability but behaves like a public handle** (exposed in listings, ignored by find-user's privacy, not the actual routing key). Pick one model: either a true secret (never listed, privacy-gated everywhere) or a public handle (then privacy must gate *contact*, not *visibility*).
- **Authorization is inconsistent per route.** Send checks connection status; reads don't (F3). Accept doesn't check the actor (F1). The consent model only holds if *every* route enforces it.
- **The mobile and web clients disagree with the server** on the privacy enum (F6), indicating the contract was never centralized.

## 4. Prioritized fix list
1. **F1** self-accept — add receiver-only check in `accept`. (Security, ~3 lines.)
2. **F2** rotate-id data loss — stop deleting shared conversations/messages. (Data loss.)
3. **F3** read-after-block — add connection-status check to message read/poll. (Security.)
4. **F4/F5** make privacy actually gate find-user and requests. (Privacy.)
5. **F6** align mobile privacy enum/labels with backend. (Silent failure.)
6. **F7** working unblock path. (Broken feature.)
7. **F9** stop leaking email in directory/lookups. (PII.)
8. **F8/F10** blocking directionality + UI clarity. (UX polish.)

_None of these are addressed by the realtime migration work; they are pre-existing behaviors in the REST routes and should be fixed independently._
