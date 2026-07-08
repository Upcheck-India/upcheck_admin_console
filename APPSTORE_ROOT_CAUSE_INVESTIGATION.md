# App Store APK Upload/Download — Root Cause Investigation

Read-only investigation. Repo root for upcheck_admin is nested at
`D:\Projects\upcheck_admin\upcheck_admin` (sibling repos:
`D:\Projects\upcheck_admin\upcheck_erp_app`, `D:\Projects\upcheck_admin\upcheck_realtime`).
Confirmed via project memory: **upcheck_admin runs on Vercel as serverless
functions** ("cannot host a socket server" — that's why realtime moved to
Render). This single fact is the thread that ties nearly every symptom
below together.

---

## 1. Where APK files are actually stored

Storage is **pluggable**, chosen per-upload and recorded on the version
document so old versions keep working even if the setting changes later.

- `src/lib/storage/index.js` — the registry. Three providers:
  `vercel-blob` (default, `DEFAULT_PROVIDER_ID` at line 26), `gridfs`,
  `uploadthing`. `getActiveProvider()` (lines 36-44) reads
  `appstore_settings.storageProvider`; falls back to `gridfs` if the
  selected provider reports `isConfigured() === false`.
- `src/lib/storage/vercelBlob.js` — default. Uses `@vercel/blob`'s `put()`
  with a `PassThrough` sink (line 27-35), private access, keyed by
  `appstore/{appId}/{version}-{timestamp}-{filename}`. `.env.local:27` has
  `BLOB_READ_WRITE_TOKEN` set, so this is almost certainly the live
  provider in production.
- `src/lib/storage/gridfs.js` — MongoDB GridFS, `appstore_apks` bucket,
  1MB chunk size (line 14), same Atlas cluster as everything else.
- `src/lib/storage/uploadthing.js` — buffers the **entire file** into a
  single `Buffer.concat(chunks)` in memory before calling
  `UTApi.uploadFiles()` (lines 25-36), bounded by `MAX_APK_SIZE_BYTES`
  (250MB, `src/lib/appstore/finalizeUpload.js:9`). If this is ever made
  active, a 250MB buffer per concurrent upload is a real memory risk on a
  serverless function (default Vercel memory is 1024MB or whatever the
  project's configured, shared with everything else running in that
  invocation).
- Admin UI to switch providers: `src/app/api/appstore/settings/route.js`
  (`storageProvider` field, lines 78/93) and
  `src/app/api/appstore/storage-usage/route.js` (per-provider usage
  stats).

None of the three storage backends is itself obviously broken. The
GridFS and Vercel Blob providers do true byte-range reads for resumable
downloads; UploadThing forwards Range to S3, which reliably honors it.

---

## 2. Upload path

Four routes implement a **chunked, resumable upload protocol** — this is
already a much more sophisticated design than a naive single-shot POST,
and on paper looks correct:

- `POST /appstore/apps/[id]/upload/init` — `src/app/api/appstore/apps/[id]/upload/init/route.js`. Does all the auth/RBAC/kill-switch/version-format/size-cap checks once, creates a session, returns an `uploadId`.
- `POST /appstore/apps/[id]/upload/chunk?uploadId=&chunkIndex=` — `src/app/api/appstore/apps/[id]/upload/chunk/route.js`. Reads the raw request body (`request.arrayBuffer()`, line 58) and writes it to its own file, `chunk_{index}.part`, under a per-session temp dir (line 63).
- `POST /appstore/apps/[id]/upload/complete?uploadId=` — `src/app/api/appstore/apps/[id]/upload/complete/route.js`. Verifies all chunks arrived, then kicks off `finalizeApkUpload()` **without awaiting it** (fire-and-forget `.then/.catch/.finally`, lines 69-82) and returns `{ processing: true }` immediately.
- `GET /appstore/apps/[id]/upload/status?uploadId=` — `src/app/api/appstore/apps/[id]/upload/status/route.js`. Polled by the client for the outcome of the background finalize job.

Session state lives in **plain in-memory `Map`s**, not a database:

- `src/lib/storage/uploadSessions.js` (upload sessions, chunk tracking) — `const sessions = new Map();` (line 13).
- `src/lib/storage/finalizeJobs.js` (background finalize job status) — `const jobs = new Map();` (line 6).

Both files contain an explicit, load-bearing, **incorrect** assumption.
`uploadSessions.js` lines 6-12:

> "This is an in-memory Map, which is correct as long as this app runs as
> a single persistent Node process (it does — `next start`, no
> serverless/edge functions, no cluster mode)."

This is false for the actual deployment. `package.json`'s `start` script
does say `next start`, but **Vercel does not run `next start` as a
long-lived process** — it builds the app into per-route serverless
functions and invokes them independently per request, with no guarantee
that two different HTTP requests (let alone requests seconds apart, from
a client uploading dozens of small chunks) land on the same warm
container. This is corroborated by the project's own memory note that
upcheck_admin "cannot host a socket server" precisely because it's
Vercel serverless.

Consequences, concretely:

- `init` creates a session in the Map of whichever container handled
  that request. If the very next `/chunk` request is routed to a
  *different* container (cold start, scale-out under concurrency, or the
  original container being recycled), `getSession(uploadId)` returns
  `null` and the chunk route responds `404 Unknown or expired upload
  session` (`chunk/route.js:37`) — indistinguishable, from the app's
  point of view, from a real TTL expiry.
- Chunk files written to `os.tmpdir()` (`uploadSessions.js:16-18`,
  `path.join(os.tmpdir(), 'appstore-chunked-uploads', uploadId)`) are
  written to *that specific container's* ephemeral filesystem. If
  `/complete` runs on a different container than the one(s) that received
  the chunks, `chunkPath()` in the finalize step points at files that
  simply don't exist there — `finalizeApkUpload`'s `concatChunkFiles()`
  (`src/lib/appstore/finalizeUpload.js:80-98`) will throw an ENOENT deep
  inside a stream pipeline, surfaced as a generic finalize error.
- Even *within* one container, `/tmp` is not guaranteed to survive; a
  container can be frozen/recycled between requests at Vercel's
  discretion, especially under any concurrent load (other users hitting
  other API routes, which all share the same function pool unless
  Vercel's per-route isolation is configured otherwise).

Client-side (`upcheck_erp_app/lib/chunkedUpload.ts`) is well-built and
already anticipates *some* of Vercel's constraints, which strongly
suggests earlier fix attempts correctly diagnosed pieces of this without
fully naming the platform mismatch:

- `CHUNK_SIZE_CANDIDATES = [8MB, 2MB, 512KB, 128KB]` (line 12), with
  automatic fallback to a smaller size on HTTP 413 or repeated 502/503/504
  (lines 15-28, 67-83). The comment attributes 413s to "some deployments"
  behind "a reverse proxy with a body size cap." In fact, **Vercel's own
  serverless Function platform enforces a hard, non-configurable ~4.5MB
  request body limit** regardless of framework or router (this is a
  platform/infra limit, not a Next.js `bodyParser` setting — App Router
  Route Handlers don't have the old Pages-Router `bodyParser` config at
  all, but the Vercel gateway limit sits in front of the function
  regardless). That means **the very first chunk of every single upload,
  at the default 8MB candidate size, is essentially guaranteed to 413 on
  Vercel**, forcing every upload through an automatic restart-at-2MB
  cycle before it can make progress. This is silently "handled" (the
  retry logic recovers), but it means every upload wastes one full
  `/init` + first-chunk round trip, leaves an orphaned session + temp dir
  behind (cleaned up only by the 2-hour TTL sweep in
  `uploadSessions.js:20-27`, which only runs opportunistically on the
  *next* `createSession()` call), and adds latency/opacity that makes
  debugging "why did my upload fail" harder for users.
- Chunk uploads are read from disk via `expo-file-system`'s
  `createUploadTask` (`chunkedUpload.ts:171-177`) so they stream from
  disk rather than holding the whole file in JS memory — good practice,
  not the problem.
- No `maxDuration`/`runtime` overrides exist anywhere in
  `src/app/api/appstore/**` (verified via grep) and there is no
  `vercel.json` in the repo at all, so every route runs at whatever the
  Vercel project's plan-default function timeout is. For `/chunk` this is
  probably fine (small payloads); it matters much more for `/complete`,
  below.

**The most serious upload bug is in `/upload/complete`.** The
commit "Finalize APK uploads in the background, add polling status
endpoint" (`8baec5a`) changed `/complete` from awaiting
`finalizeApkUpload()` synchronously (which could exceed a reverse
proxy's/Vercel's timeout on a large file) to firing it off and returning
immediately:

```js
// src/app/api/appstore/apps/[id]/upload/complete/route.js:68-82
createJob(uploadId);
finalizeApkUpload({ db, app, session, chunkPaths })
  .then((result) => { completeJob(uploadId, result); })
  .catch((streamErr) => { ...; failJob(uploadId, message); })
  .finally(() => { deleteSession(uploadId).catch(() => {}); });

return NextResponse.json({ success: true, processing: true, uploadId });
```

This is a real fix for the *proxy-timeout* symptom, but it introduces a
worse one on Vercel specifically: **a standard (non-Fluid-Compute)
Vercel serverless Function invocation is not guaranteed to keep running
after its HTTP response has been sent.** The documented, supported way to
do exactly this pattern on Vercel is `waitUntil()` from `@vercel/functions`
(or Next's equivalent `after()`). Neither is used anywhere in this repo
(verified via grep for `waitUntil`, `after(`, `@vercel/functions` across
`src/` and in `package.json` — no matches). Without it, the concat →
size/zip-magic validate → hash → upload-to-Blob/GridFS/UploadThing
pipeline in `finalizeApkUpload()` (`src/lib/appstore/finalizeUpload.js:106-198`)
is at real risk of being **frozen mid-flight** the instant the response
is flushed — which would manifest exactly as what the user is describing:
the client polls `/upload/status` (`chunkedUpload.ts:154-169`, up to ~10
minutes) and it just sits in `processing` forever, or the job entry in
the in-memory `jobs` Map (`finalizeJobs.js`) never gets updated because
the code that would update it never got to run, or got to run on a
container that then recycled before the polling client's `/status`
request (which could hit a *different* container with an empty `jobs`
Map) ever sees it — producing "Unknown or expired finalize job" 404s
(`status/route.js:24`) that look identical to a real TTL expiry.

This is the single most likely explanation for **upload failures that
manifest as a hang or an opaque "processing failed" after all chunks
apparently succeeded** — the escalating series of prior fixes chased
proxy timeouts and chunk sizes correctly, but the newest fix
(backgrounding the finalize step) trades a loud, honest 504 for a silent
failure mode that's specific to Vercel's execution model, which none of
the prior commits addressed.

---

## 3. Download path

- `GET /appstore/download/[versionId]` — `src/app/api/appstore/download/[versionId]/route.js`.
- Version lookup is by the version sub-document's own stable `_id`
  (line 26), independent of which storage backend actually holds the
  bytes — `getProviderForVersion(version)` (line 127,
  `src/lib/storage/index.js:49-51`) branches per-version on its recorded
  `storageProvider`, so a provider switch never orphans old downloads.
  This part is correctly designed.
- **True streaming, not buffering**: all three providers return a
  `webStream` (Vercel Blob's SDK stream, GridFS's `Readable.toWeb()`, or
  UploadThing's raw `fetch()` body) that's piped straight into the
  `Response` (lines 141/144) — the whole file is never held in memory on
  the server for downloads. This is good and not part of the problem.
- **Range/resume support exists** but is provider-dependent in
  reliability:
  - GridFS (`gridfs.js:40-60`): genuine, precise byte-range reads via
    `openDownloadStream({ start, end })`. Trustworthy.
  - UploadThing (`uploadthing.js:58-76`): forwards Range to the
    underlying S3 URL, which reliably honors it per the code comment.
    Trustworthy.
  - Vercel Blob (`vercelBlob.js:60-76`): explicitly commented as
    "best-effort" — the `@vercel/blob` SDK has no first-class Range
    support, so the code forwards a raw `Range` header and only trusts a
    206 if the SDK's underlying fetch actually returns a
    `content-range` header back; otherwise it silently serves the whole
    file as a 200. **If Vercel Blob is the live default provider (which
    `.env.local` suggests it is), resuming a dropped download of a large
    APK may silently restart from byte 0 instead of actually resuming**,
    even though the client believes it requested a partial range. This
    wouldn't error, but it would make "download keeps restarting on a
    flaky connection" a very plausible complaint that looks like a bug
    but is actually a Vercel Blob API/SDK limitation, not something the
    admin app can control.
- App-side (`upcheck_erp_app/app/appstore.tsx:842-872`) uses
  `expo-file-system`'s `createDownloadResumable` with up to 4 attempts,
  calling `resumeAsync()` on retries so a dropped connection only
  re-requests the remaining bytes via Range — correctly written to match
  what the server (mostly) supports. Errors are surfaced via `showAlert`
  with `e.message` (line 898) — reasonable, though it doesn't attempt to
  read a JSON error body the way the chunk-upload code does
  (`chunkedUpload.ts:209`), so a structured server error (e.g. "Forbidden:
  You do not have permission to download this app") may show up as a
  generic Expo/axios error message instead of the actual reason.
- One correctness note: the download-counter increment
  (`download/[versionId]/route.js:117-122`) only fires "if `!range` or
  `range.start === 0`" — reasonable intent (don't double-count a resumed
  tail), but combined with the Vercel Blob best-effort Range behavior
  above, a resumed download that silently falls back to a full 200 (no
  `range` object returned from the provider) would still be counted as
  fresh even though the *request* had a non-zero `Range` header — a very
  minor metrics inaccuracy, not a functional bug.
- Older versions uploaded before the "record APK size" commit
  (`bb3c57e`) have no `version.sizeBytes`. In that case an open-ended
  `Range: bytes=N-` request resolves `end` to `undefined`
  (`download/[versionId]/route.js:108`), which causes the range-parsing
  `if` to fail and the whole file to be served instead of the actual tail
  — meaning resuming a previously-uploaded old version's download always
  restarts from scratch. Minor, self-healing over time as old versions
  age out (only 3 versions are kept per app, per
  `finalizeUpload.js:155-160`).

No evidence of the download route ever buffering a whole file into
memory — that part of the "escalating series of fixes" (the "Stream APK
upload/download instead of buffering" commit, `88a3031`) appears to have
actually landed correctly and stuck.

---

## 4. Vercel platform constraints — what's plausibly being hit

| Constraint | Applies here? | Evidence |
|---|---|---|
| ~4.5MB serverless Function request body limit | **Yes, on the very first chunk of every upload** | Client's largest candidate chunk is 8MB (`chunkedUpload.ts:12`); this is a Vercel infra-level limit, not a Next.js `bodyParser` config (App Router Route Handlers don't have that Pages-Router option at all) |
| Function execution timeout (plan-dependent; not overridden here) | Plausible for large/slow chunk uploads, but largely mitigated by chunking + retry-driven downsizing already in place | No `maxDuration` or `vercel.json` anywhere in the repo (verified) |
| No persistent local disk across invocations | **Yes — this is the core issue** | `uploadSessions.js` stores sessions + chunk files under `os.tmpdir()` keyed only by an in-memory `Map`; comment at lines 6-12 explicitly (and incorrectly) assumes a single persistent process |
| "Fire and forget" background work after the response is sent | **Yes — likely the proximate cause of stuck/failed finalizes** | `/upload/complete` (lines 69-82) starts `finalizeApkUpload()` without `waitUntil()`/`after()` and without awaiting it; neither is imported anywhere in the repo |
| Serverless Function memory ceiling | Only a risk if UploadThing becomes the active provider (buffers whole file, up to 250MB) | `uploadthing.js:25-36` |
| Ephemeral `/tmp` size ceiling (Vercel default ~512MB unless configured) | Possible contributing factor for large APKs uploaded as many small chunks that all sit in `/tmp` simultaneously until finalize deletes the session | `uploadSessions.js` writes every chunk to disk and only cleans up in `deleteSession()`, called from `/complete`'s `.finally()` — itself gated on the finalize job actually completing |

The throughline: **every previous fix (binary streaming → chunked/resumable
→ proxy-limit resilience → version-id-keyed downloads → size display)
correctly treated Vercel as "a web server with some quirks."** None of
them treated it as what it actually is for this feature: a fleet of
independent, ephemeral, non-sticky function invocations with no shared
memory and no guaranteed post-response execution. The chunk protocol's
correctness *depends on* session/file state surviving across multiple
independent requests, which Vercel does not promise. That's why fixing
proxy timeouts, chunk sizes, and range support all failed to fully solve
"still get errors both ways" — those fixes address real but secondary
issues sitting on top of a foundational platform mismatch.

---

## 5. Other concrete bugs / fragility found while reading

1. **`src/lib/storage/uploadSessions.js:6-12` and
   `src/lib/storage/finalizeJobs.js:1-6`** — false single-process
   assumption, as detailed above. This is the root architectural bug.
2. **`src/app/api/appstore/apps/[id]/upload/complete/route.js:69-82`** —
   background work fired without `waitUntil()`/`after()`; not guaranteed
   to run to completion on Vercel. Root cause of silent finalize
   failures/hangs.
3. **`src/lib/storage/vercelBlob.js:60-76`** — Range support is
   best-effort only; a resumed download can silently fall back to a full
   200 response with no error, which is spec-safe but means "resume"
   doesn't always actually resume when Vercel Blob is the active
   provider.
4. **`src/app/api/appstore/download/[versionId]/route.js:108`** — for
   versions with no recorded `sizeBytes` (pre-`bb3c57e`), an open-ended
   `Range: bytes=N-` request can't be resolved and silently falls back to
   serving the whole file — resume restarts from scratch for old
   versions.
5. **Client chunk-size ladder starts above the Vercel body limit** —
   `upcheck_erp_app/lib/chunkedUpload.ts:12`, `8 * 1024 * 1024` as the
   first candidate. Every upload burns a wasted `/init` + first-chunk
   round trip (and leaves an orphaned session/tempdir until the 2-hour
   TTL sweep) before dropping to a size that can actually get through.
   Starting at 2MB would remove this guaranteed-failed first attempt.
6. **Orphaned upload sessions accumulate silently.** `cleanupStale()`
   (`uploadSessions.js:20-27`) only runs when a *new* `createSession()`
   call happens to land on the same warm container that holds the stale
   sessions — on Vercel, with rotating containers, stale session temp
   directories under `os.tmpdir()` can persist until that whole container
   is recycled by the platform; there's no proactive sweep.
7. **Error surfacing is inconsistent between chunk upload and download.**
   `chunkedUpload.ts:209` explicitly parses a JSON error body from a
   failed chunk response; the download path
   (`appstore.tsx:897-898`) just uses `e.message` from the thrown error
   without attempting to read a structured server error body, so
   permission/kill-switch errors on download surface less clearly to the
   user than the equivalent errors do on upload.
8. **`finalizeUpload.js:155-160`** — pruning the oldest version when more
   than 3 exist calls `getProviderForVersion(oldest).deleteFile(db, oldest)`
   and swallows any error (`.catch(() => {})`), then unconditionally
   `.shift()`s it out of `updatedVersions` regardless of whether the
   delete actually succeeded. Not urgent, but means a failed delete on
   the storage backend leaves an orphaned blob/GridFS file with no DB
   record pointing at it (a storage leak, not a functional bug for
   users).

No off-by-one was found in chunk indexing (0-based throughout, `totalChunks`
and `MAX_CHUNKS` bounds check out at `init/route.js:73` and
`chunk/route.js:46`), and RBAC/kill-switch checks on both upload and
download look consistent and correctly enforced role/team/user
allow-and-exclude logic.

---

## 6. Render migration feasibility

**Assessment: migrating App Store upload/download to a plain persistent
Node service (alongside/inside `upcheck_realtime`, or as a sibling
service on Render) would eliminate essentially every root cause found
above, for a moderate, well-scoped amount of new work.**

What Render removes for free, by virtue of being a persistent process
instead of serverless functions:

- **In-memory session/job Maps become correct as designed.** The
  comments in `uploadSessions.js`/`finalizeJobs.js` describing "a single
  persistent Node process" would finally be *true*. No protocol change
  needed — same chunk/init/complete/status routes, same client, just
  hosted somewhere the assumption holds.
- **No request body size ceiling like Vercel's ~4.5MB.** Chunk size could
  go back up to whatever's actually efficient (or even revert to a
  single-shot streamed upload, though keeping chunking is still valuable
  for resumability on flaky mobile connections regardless of host).
- **No execution-timeout risk on `/complete`.** `finalizeApkUpload()`
  could go back to being awaited synchronously and just return the
  result directly — no background job, no polling endpoint, no window
  for the process to be "frozen mid-flight," which deletes bug #2 above
  entirely along with the extra client-side polling complexity in
  `pollFinalizeStatus()`.
- **Real persistent disk** (or the option to skip disk entirely and
  stream chunks straight into GridFS/Blob/S3 as they arrive) instead of
  ephemeral `/tmp` shared uncertainly across invocations.

What already carries over directly, proven by `upcheck_realtime`:

- **Same MongoDB Atlas cluster, same access pattern.** `upcheck_realtime/src/db.js`
  is a straightforward `MongoClient` singleton against
  `process.env.MONGODB_URI`/`MONGODB_DB` — the exact shape needed for the
  App Store routes' `db.collection('appstore_apps')` etc. calls. The
  realtime service today is explicitly read-only by design choice
  (`db.js:6-9` comment: "This service only ever READS ... never a write
  path"), not by technical limitation — nothing stops a sibling
  Express route or a small addition to the same service from doing
  `updateOne`/`insertOne` the same way `upcheck_admin`'s API routes do
  today, using the same driver and connection string.
- **Auth pattern is portable.** `upcheck_admin`'s Bearer-token auth
  (`src/lib/auth.js`) reads `admin_sessions`/`admin_users` by token — a
  Render service can implement the identical lookup (or, more simply,
  call back into `upcheck_admin`'s existing session-validation logic if
  it's extracted into a shared/duplicated module) since it's just a
  MongoDB query against the same cluster `upcheck_realtime` already
  connects to.

Real tradeoffs to weigh, not solved automatically:

- **Two backend hosts for one feature.** The mobile app would call
  `erp.upcheck.in/api/appstore/...` today; after migration it'd call a
  different host (e.g. `<something>.onrender.com` or a custom domain
  pointed at Render) for App Store specifically, while everything else
  stays on Vercel. That's an added seam: CORS must be configured on the
  Render service the same way `upcheck_realtime` already does
  (`config.js:16-21`, `CORS_ORIGINS`), and the app needs a second base
  URL/env var (mirroring how `REALTIME_URL` already exists alongside
  `API_URL` in `upcheck_erp_app/lib/api.ts` and its realtime
  counterpart) — this is a known, already-solved pattern in this
  codebase, not a new category of problem.
- **Render's own limits.** Free/starter instances spin down on
  inactivity (cold-start latency on first request after idle, though
  nowhere near as disruptive as losing session state entirely) and have
  their own disk/memory ceilings — but since the whole point is a
  *persistent* process, "spin down after idle" only costs a one-time
  reconnect delay, not correctness, unlike Vercel's per-request
  ephemerality which corrupts the upload protocol's core assumption.
  Whichever Render plan is already sized for `upcheck_realtime` should be
  re-evaluated for the added CPU/bandwidth of relaying APK bytes (uploads
  and downloads both proxy through the service to storage), which is a
  meaningfully different load profile than Socket.IO connection-holding.
- **Auth parity work.** Non-trivial but mechanical: either duplicate the
  session-lookup logic into the Render service (small, ~100 lines, given
  `src/lib/auth.js`'s `resolveAuthOnce` is already simple and DB-only —
  no Next.js-specific APIs beyond `next/headers` cookie fallback, which a
  Bearer-only mobile client doesn't need anyway) or factor it into a
  tiny shared package. Given the mobile app already sends
  `Authorization: Bearer <token>` (`upcheck_erp_app/lib/api.ts:34`,
  `chunkedUpload.ts:107,176`) and doesn't rely on cookies, the Render
  side only needs the Bearer-header branch of `extractToken()`
  (`auth.js:16-25`), not the cookie-fallback branch — meaningfully less
  code than the full `auth.js`.
- **Storage provider code is already host-agnostic.** `src/lib/storage/*.js`
  has no Vercel-specific dependencies beyond the `@vercel/blob` package
  itself (which works fine from any Node process, not just Vercel
  Functions — it's just an HTTP client to Vercel's Blob API) — so the
  provider abstraction, GridFS bucket logic, and UploadThing integration
  can be ported to Render essentially unchanged.
- **What should NOT be kept as-is**: the chunked-upload protocol's
  complexity (separate init/chunk/complete/status routes, client-side
  chunk-size ladder with 413 detection, background finalize + polling)
  exists specifically to work around Vercel's constraints. On a
  persistent Render process, most of that machinery becomes unnecessary
  complexity — a single streamed multipart/binary upload with a
  generous timeout would work and would be simpler to reason about and
  debug than the current 4-endpoint dance. Migrating "as-is" (keeping the
  chunked protocol) would still fix the correctness bugs (shared memory
  finally being real, no execution-timeout risk) but would leave
  avoidable complexity in place; a follow-up simplification pass once on
  Render would be worth doing rather than treating the chunked protocol
  as permanent.

**Bottom line**: this is a good candidate for migration. The two
Vercel-specific bugs found (in-memory state assumed-but-not-guaranteed
to survive across invocations, and fire-and-forget background work with
no `waitUntil()`) are architectural, not fixable by more retry logic or
smaller chunk sizes — which is consistent with why five successive
targeted fixes have not resolved user-visible errors. Moving to Render
directly removes the platform assumptions that keep being violated, and
the sibling `upcheck_realtime` service already proves out the exact
MongoDB connection pattern and env-var/CORS conventions needed to do it
with low incremental risk.
