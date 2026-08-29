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
const options = {};

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

// Automatically clear stale bot locks on startup/restart
clientPromise.then(async (resolvedClient) => {
  try {
    const db = resolvedClient.db('resources');
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
    ]);

    const failed = indexResults.filter((r) => r.status === 'rejected');
    if (failed.length) {
      console.error(
        `Failed to ensure ${failed.length} of ${indexResults.length} index(es) on startup:`,
      );
      for (const f of failed) console.error('  -', f.reason?.message || f.reason);
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