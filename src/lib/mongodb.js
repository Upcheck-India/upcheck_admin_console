// src/lib/mongodb.js
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';

if (!global.mongoose) {
  global.mongoose = { conn: null, promise: null };
}

if (!process.env.MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

const uri = process.env.MONGODB_URI;

// Deployment note, because it is not visible from this file and it dominates
// every other number in the system: the Atlas cluster is in AWS Mumbai
// (ap-south-1), so the Vercel functions are pinned to bom1 in vercel.json.
// They previously ran in iad1, which put roughly 220ms of ocean between this
// process and the database — on a route doing five queries that was over a
// second of latency before any work happened. If either side is ever moved,
// move the other with it.
const options = {
  // Default is 100 PER CLIENT, and every serverless instance builds its own.
  // The M0 tier caps the whole cluster at 500 connections, so a handful of
  // concurrent instances could exhaust it and start refusing connections
  // outright — and mongoose (below) opens a second pool per instance on top of
  // this one. Ten is comfortably more than one instance can use in parallel
  // now that a query is a couple of milliseconds rather than a couple of
  // hundred.
  maxPoolSize: 10,
  // An unreachable cluster should fail the request, not hold it for the 30s
  // default while the client's socket and the caller's screen both wait.
  serverSelectionTimeoutMS: 8000,
};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Bump whenever an index is added to or changed in the list below. That is the
// only thing that makes the ~180 createIndex calls run again.
const INDEX_SET_VERSION = 1;

// How often stale bot-processing locks are swept, at most.
const BOT_LOCK_SWEEP_MS = 5 * 60 * 1000;

// Both blocks below used to run on EVERY module load. On Vercel that is every
// cold serverless instance, not "on startup" — so each new instance fired three
// collection-wide updateMany writes plus ~180 createIndex round trips at Atlas
// before, and concurrently with, the first real query it was spun up to serve.
// They are no-ops in effect but not in cost, and they were competing for the
// same connection pool as the request the user was waiting on.
//
// This gate turns each into a single findOne against a tiny marker collection.
// The work still happens — when the index set actually changes, or when the
// lock sweep is genuinely due — just not once per instance.
//
// Returns true if the caller should do the work (and records that it did).
async function claimBootstrap(db, id, isDue) {
  try {
    const marker = await db.collection('_bootstrap').findOne({ _id: id });
    if (!isDue(marker)) return false;
    // Best-effort. A race between two cold instances costs one duplicated
    // sweep, which is harmless; a lock here would cost more than it saves.
    await db
      .collection('_bootstrap')
      .updateOne({ _id: id }, { $set: { at: new Date(), version: INDEX_SET_VERSION } }, { upsert: true });
    return true;
  } catch (err) {
    // Marker unreadable — do the work rather than silently skipping it, which
    // is the behaviour this code had before the gate existed.
    console.error(`Bootstrap marker '${id}' check failed, running anyway:`, err?.message || err);
    return true;
  }
}

// Clear stale bot locks, at most once every BOT_LOCK_SWEEP_MS across the fleet.
clientPromise.then(async (resolvedClient) => {
  try {
    const db = resolvedClient.db('resources');
    const due = await claimBootstrap(db, 'botlocks', (m) =>
      !m?.at || Date.now() - new Date(m.at).getTime() > BOT_LOCK_SWEEP_MS
    );
    if (!due) return;
    await Promise.all([
      db.collection('conversations').updateMany({ isBotProcessing: true }, { $set: { isBotProcessing: false }, $unset: { botProcessingStartedAt: "" } }),
      db.collection('group_chats').updateMany({ isBotProcessing: true }, { $set: { isBotProcessing: false }, $unset: { botProcessingStartedAt: "" } }),
      db.collection('teams').updateMany({ isBotProcessing: true }, { $set: { isBotProcessing: false }, $unset: { botProcessingStartedAt: "" } })
    ]);
  } catch (err) {
    console.error('Failed to clear stale bot processing locks on startup:', err);
  }
}).catch(() => {});

// Ensure messaging indexes exist (idempotent, runs once per process, fire-and-
// forget so it never blocks the first request). Auth previously did an
// unindexed COLLSCAN of admin_sessions/admin_users on EVERY request, and
// team/group message + typing + mute queries had no index at all and scanned
// growing collections on every 2s poll. createIndex is a no-op when the index
// already exists.
clientPromise.then(async (resolvedClient) => {
  try {
    const db = resolvedClient.db('resources');
    const due = await claimBootstrap(
      db,
      'indexes',
      (m) => m?.version !== INDEX_SET_VERSION
    );
    if (!due) return;
    // allSettled, not all: a single index that cannot be built (a unique index
    // over data that already has duplicates, say) must not mask the outcome of
    // the ~120 others. Each failure is reported on its own below.
    const indexResults = await Promise.allSettled([
      // Auth — hit on every single API request
      db.collection('admin_sessions').createIndex({ token: 1 }),
      db.collection('admin_users').createIndex({ sessionToken: 1 }, { sparse: true }),
      // Message reads/polls
      db.collection('chat_messages').createIndex({ conversationId: 1, createdAt: -1 }),
      db.collection('team_messages').createIndex({ teamId: 1, createdAt: 1 }),
      db.collection('group_chat_messages').createIndex({ groupId: 1, createdAt: 1 }),
      // Optimization indexes for unread count polling
      db.collection('chat_messages').createIndex({ conversationId: 1, recipientId: 1, status: 1 }),
      db.collection('group_chat_messages').createIndex({ groupId: 1, 'readBy.userId': 1 }),
      db.collection('team_messages').createIndex({ teamId: 1, 'readBy.userId': 1 }),
      // Idempotency dedupe by clientId
      db.collection('team_messages').createIndex({ clientId: 1 }, { sparse: true }),
      db.collection('group_chat_messages').createIndex({ clientId: 1 }, { sparse: true }),
      // Typing (polled every cycle)
      db.collection('dm_typing').createIndex({ conversationId: 1, updatedAt: 1 }),
      db.collection('team_typing').createIndex({ teamId: 1, updatedAt: 1 }),
      db.collection('group_typing').createIndex({ groupId: 1, updatedAt: 1 }),
      // Mute lookups on send + poll
      db.collection('chat_mutes').createIndex({ chatId: 1, chatType: 1 }),
      db.collection('chat_mutes').createIndex({ userId: 1, chatType: 1 }),
      // Connections list
      db.collection('chat_connections').createIndex({ userId: 1, status: 1 }),
      // What's New / changelogs
      db.collection('changelogs').createIndex({ isPublished: 1, createdAt: -1 }),
      db.collection('changelog_seen').createIndex({ userId: 1, changelogId: 1 }, { unique: true }),
      // Finance — idempotency keys for money moves (unique so a replayed
      // transfer/receive can never post a second ledger entry), plus account
      // scoping for balance/trend aggregations.
      db.collection('org_funds').createIndex({ opId: 1 }, { unique: true, sparse: true }),
      db.collection('org_funds').createIndex({ accountId: 1, date: -1 }),
      db.collection('org_untransferred').createIndex({ opId: 1 }, { sparse: true }),
      db.collection('org_untransferred').createIndex({ 'history.opId': 1 }),
      // Append-only finance audit trail
      db.collection('finance_audit_log').createIndex({ at: -1 }),
      db.collection('finance_audit_log').createIndex({ collection: 1, documentId: 1, at: -1 }),
      // Phase 2 modules
      db.collection('vendors').createIndex({ name: 1 }),
      db.collection('vendor_bills').createIndex({ vendorId: 1, status: 1, dueDate: 1 }),
      // Recurring/subscription bills: schedules + generation idempotency
      db.collection('vendor_subscriptions').createIndex({ vendorId: 1, status: 1 }),
      db.collection('vendor_subscriptions').createIndex({ status: 1, nextDueDate: 1 }),
      db.collection('vendor_bills').createIndex({ subscriptionId: 1, periodKey: 1 }, { unique: true, sparse: true }),
      db.collection('cost_centers').createIndex({ code: 1 }, { unique: true, sparse: true }),
      db.collection('fixed_assets').createIndex({ accountId: 1, status: 1 }),
      db.collection('compliance_items').createIndex({ dueDate: 1, status: 1 }),
      // Phase 3 — double-entry general ledger, fiscal periods, bank reconciliation
      db.collection('gl_accounts').createIndex({ code: 1 }, { unique: true }),
      db.collection('journal_entries').createIndex({ date: -1 }),
      db.collection('journal_entries').createIndex({ 'lines.accountCode': 1, date: -1 }),
      db.collection('journal_entries').createIndex({ 'meta.accountId': 1, date: -1 }),
      db.collection('journal_entries').createIndex({ source: 1, reference: 1 }, { unique: true, sparse: true }),
      db.collection('journal_entries').createIndex({ opId: 1 }, { unique: true, sparse: true }),
      db.collection('fiscal_periods').createIndex({ key: 1 }, { unique: true }),
      db.collection('fiscal_periods').createIndex({ start: 1, end: 1 }),
      db.collection('bank_statements').createIndex({ accountId: 1, statementDate: -1 }),
      db.collection('bank_txns').createIndex({ accountId: 1, date: -1 }),
      db.collection('bank_txns').createIndex({ statementId: 1 }),
      db.collection('bank_txns').createIndex({ reconciled: 1, accountId: 1 }),
      // Multi-currency rate cache (persisted fallback when providers are down)
      db.collection('fx_rates').createIndex({ pair: 1 }, { unique: true }),
      // Bank-detail fingerprint on billing accounts (verify / de-dupe; never the number itself)
      db.collection('finance_accounts').createIndex({ 'bank.accountNumberHash': 1 }, { sparse: true }),
      // Finance maintenance: mode/settings, master-reset backups, protected admin log
      db.collection('finance_backups').createIndex({ createdAt: -1 }),
      db.collection('finance_backup_items').createIndex({ backupId: 1, coll: 1 }),
      db.collection('finance_admin_log').createIndex({ at: -1 }),
      // Upcheck ERP Data OAuth — authorization server + resource server.
      // Registered apps (clientId unique for the lookup on every token/authorize).
      db.collection('oauth_clients').createIndex({ clientId: 1 }, { unique: true }),
      db.collection('oauth_clients').createIndex({ status: 1 }),
      // Pending consent requests — single-use + TTL auto-cleanup.
      db.collection('oauth_auth_requests').createIndex({ requestId: 1 }, { unique: true }),
      db.collection('oauth_auth_requests').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      // Authorization codes — hashed, single-use, short TTL.
      db.collection('oauth_authorization_codes').createIndex({ codeHash: 1 }, { unique: true }),
      db.collection('oauth_authorization_codes').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      // Access tokens — hashed lookup on every resource call; TTL clears expired.
      db.collection('oauth_access_tokens').createIndex({ tokenHash: 1 }, { unique: true }),
      db.collection('oauth_access_tokens').createIndex({ grantId: 1 }),
      db.collection('oauth_access_tokens').createIndex({ clientId: 1 }),
      db.collection('oauth_access_tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      // Refresh tokens — hashed; kept until expiry for rotation/reuse detection.
      db.collection('oauth_refresh_tokens').createIndex({ tokenHash: 1 }, { unique: true }),
      db.collection('oauth_refresh_tokens').createIndex({ grantId: 1 }),
      db.collection('oauth_refresh_tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      // Grants (connected apps) — one active per client.
      db.collection('oauth_grants').createIndex({ grantId: 1 }, { unique: true }),
      db.collection('oauth_grants').createIndex({ clientId: 1, status: 1 }),
      // Append-only OAuth audit trail.
      db.collection('oauth_audit_log').createIndex({ at: -1 }),
      db.collection('oauth_audit_log').createIndex({ clientId: 1, at: -1 }),
      db.collection('oauth_audit_log').createIndex({ action: 1, at: -1 }),
      // Rate-limiter fixed windows — TTL sweeps old buckets.
      db.collection('oauth_rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

      // ─── Data room ────────────────────────────────────────────────────
      // These 20 collections had NO indexes at all: the only two in the
      // codebase lived in /api/dataroom/init, which ran once, manually, and
      // only if dataroom_folders did not yet exist. Every permission check
      // was a COLLSCAN, and hasPermission fires up to a dozen of them per
      // call — the single largest source of the module's latency.

      // Permissions — the hottest path. Read on every access decision, both
      // by resource (hasPermission) and by principal (getAccessibleDocumentsFilter).
      db.collection('dataroom_permissions').createIndex({ resourceType: 1, resourceId: 1 }),
      db.collection('dataroom_permissions').createIndex({ userId: 1 }),
      db.collection('dataroom_permissions').createIndex({ userEmail: 1 }),
      db.collection('dataroom_permissions').createIndex({ groupId: 1 }, { sparse: true }),
      db.collection('dataroom_permissions').createIndex({ teamId: 1 }, { sparse: true }),
      db.collection('dataroom_permissions').createIndex({ expiresAt: 1 }, { sparse: true }),

      // Documents — listing, foldering, and the per-room index counter.
      db.collection('dataroom_documents').createIndex({ roomId: 1, folderId: 1, isDeleted: 1 }),
      db.collection('dataroom_documents').createIndex({ roomId: 1, indexNumber: -1 }),
      db.collection('dataroom_documents').createIndex({ roomId: 1, createdAt: -1 }),
      db.collection('dataroom_documents').createIndex({ 'createdBy.id': 1 }),
      db.collection('dataroom_documents').createIndex({ name: 1 }),

      // Folders — hierarchy walks and the materialized path.
      // Name pinned to match the index /api/dataroom/init used to create —
      // same keys under a different name is an error, not a no-op.
      db.collection('dataroom_folders').createIndex(
        { roomId: 1, path: 1 },
        { unique: true, name: 'room_path_unique' },
      ),
      db.collection('dataroom_folders').createIndex({ roomId: 1, parentId: 1 }),

      // Rooms — ownership filter on the room list, plus expiry sweeps.
      db.collection('dataroom_rooms').createIndex({ ownerId: 1 }),
      db.collection('dataroom_rooms').createIndex({ isDeleted: 1, expiresAt: 1 }),

      // Audit trail — always read newest-first, scoped to a room or resource.
      db.collection('dataroom_audit_log').createIndex({ timestamp: -1 }),
      db.collection('dataroom_audit_log').createIndex({ roomId: 1, timestamp: -1 }),
      db.collection('dataroom_audit_log').createIndex({ resourceType: 1, resourceId: 1, timestamp: -1 }),
      db.collection('dataroom_audit_log').createIndex({ userId: 1, timestamp: -1 }),

      // External users — sessionToken is hit on every external request.
      db.collection('dataroom_external_users').createIndex({ sessionToken: 1 }, { sparse: true }),
      db.collection('dataroom_external_users').createIndex({ email: 1 }, { unique: true }),

      // Shares — token lookup must be unique and indexed; it is a credential.
      db.collection('dataroom_shares').createIndex({ shareToken: 1 }, { unique: true }),
      db.collection('dataroom_shares').createIndex({ resourceType: 1, resourceId: 1 }),
      db.collection('dataroom_shares').createIndex({ targetEmail: 1 }),
      db.collection('dataroom_shares').createIndex({ allowedEmails: 1 }),

      // Cached server-side page renders. The key is unique so two readers
      // opening the same page at once cannot both leave a record behind.
      db.collection('dataroom_page_renders').createIndex(
        { documentId: 1, version: 1, page: 1, width: 1 },
        { unique: true, name: 'page_render_key' },
      ),

      // Documents imported from the Documentation module carry their origin.
      // Sparse because only imported documents have it, which is most rooms'
      // minority.
      db.collection('dataroom_documents').createIndex(
        { 'source.resourceId': 1 },
        { sparse: true, name: 'document_source_resource' },
      ),

      // Share-link sessions and their one-time codes. Both expire on their
      // own via TTL indexes: a session left behind is a working credential,
      // and an unswept code collection grows for the life of the deployment.
      db.collection('dataroom_share_sessions').createIndex({ token: 1 }, { unique: true }),
      db.collection('dataroom_share_sessions').createIndex({ shareId: 1 }),
      db.collection('dataroom_share_sessions').createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: 'share_session_ttl' },
      ),
      db.collection('dataroom_share_codes').createIndex(
        { shareId: 1, email: 1 },
        { unique: true },
      ),
      db.collection('dataroom_share_codes').createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: 'share_code_ttl' },
      ),

      // Versions, analytics, groups.
      db.collection('dataroom_versions').createIndex({ documentId: 1, versionNumber: -1 }),
      db.collection('dataroom_analytics').createIndex({ documentId: 1, userId: 1 }),
      db.collection('dataroom_analytics').createIndex({ roomId: 1 }),
      db.collection('dataroom_user_groups').createIndex({ 'members.userId': 1 }),
      db.collection('dataroom_user_groups').createIndex({ 'members.email': 1 }),

      // Per-room feature collections — all queried by room, newest first.
      db.collection('dataroom_comments').createIndex({ documentId: 1, createdAt: -1 }),
      db.collection('dataroom_tasks').createIndex({ roomId: 1, status: 1 }),
      db.collection('dataroom_qa').createIndex({ roomId: 1, createdAt: -1 }),
      db.collection('dataroom_workflows').createIndex({ roomId: 1, status: 1 }),
      db.collection('dataroom_access_requests').createIndex({ roomId: 1, status: 1 }),
      db.collection('dataroom_signatures').createIndex({ roomId: 1, userId: 1, type: 1 }),
      db.collection('dataroom_metadata_templates').createIndex({ roomId: 1 }),
      db.collection('dataroom_parties').createIndex({ roomId: 1 }),
      db.collection('dataroom_ip_whitelist').createIndex({ roomId: 1 }),
      db.collection('dataroom_activity_heartbeat').createIndex({ documentId: 1, updatedAt: -1 }),
      // Presence rows self-expire. Previously created inside the heartbeat
      // handler itself, costing a round-trip per beat, per viewer.
      db.collection('dataroom_activity_heartbeat').createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },
      ),
      // Claimable time blocks — the Blocks tab in /scheduling.
      db.collection('schedule_blocks').createIndex({ ownerId: 1, status: 1 }),
      db.collection('schedule_blocks').createIndex({ status: 1, updatedAt: -1 }),
      // The grid feed: every day/week/month view is a range scan in one block.
      db.collection('schedule_claims').createIndex({ blockId: 1, startTime: 1 }),
      // Quota sums, as equality matches on keys bucketed in the block's zone.
      db.collection('schedule_claims').createIndex({ blockId: 1, userId: 1, dayKey: 1 }),
      db.collection('schedule_claims').createIndex({ blockId: 1, userId: 1, weekKey: 1 }),
      db.collection('schedule_claims').createIndex({ userId: 1, startTime: -1 }),
      // THE RACE FIX. Every claim expands into one row per granularity slot;
      // `seat` runs 0..capacity-1, so a block with capacity 3 admits exactly
      // three holders per slot. The loser of a race gets a duplicate-key error
      // from Mongo — an authoritative refusal, not a read-then-write guess.
      // A single { blockId, startTime } index would only protect a claim's
      // first minute and a claim starting inside another would slip past it.
      db.collection('schedule_claim_slots').createIndex(
        { slotKey: 1, seat: 1 },
        { unique: true, partialFilterExpression: { active: true } },
      ),
      db.collection('schedule_claim_slots').createIndex({ claimId: 1 }),
    ]);

    const failed = indexResults.filter((r) => r.status === 'rejected');
    if (failed.length) {
      console.error(
        `Failed to ensure ${failed.length} of ${indexResults.length} index(es) on startup:`,
      );
      for (const f of failed) console.error('  -', f.reason?.message || f.reason);
      // Roll the marker back so the next cold instance retries rather than
      // leaving an index permanently missing because one attempt half-failed.
      await db
        .collection('_bootstrap')
        .updateOne({ _id: 'indexes' }, { $unset: { version: '' } })
        .catch(() => {});
    }
  } catch (err) {
    console.error('Failed to ensure indexes on startup:', err);
  }
}).catch(() => {});

// Mongoose connection management
export async function connectToDatabase() {
  if (global.mongoose.conn) {
    return global.mongoose.conn.connection;
  }

  if (!global.mongoose.promise) {
    const opts = {
      dbName: 'resources',
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    };

    global.mongoose.promise = mongoose.connect(uri, opts).then((mongoose) => {
      console.log('Connected to MongoDB with Mongoose (dbName: resources)');
      return mongoose;
    }).catch(err => {
      console.error('MongoDB connection error:', err);
      global.mongoose.promise = null;
      throw err;
    });
  }

  global.mongoose.conn = await global.mongoose.promise;
  return global.mongoose.conn.connection;
}

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
  global.mongoose.promise = null;
  global.mongoose.conn = null;
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
  global.mongoose.promise = null;
  global.mongoose.conn = null;
});

export default clientPromise;