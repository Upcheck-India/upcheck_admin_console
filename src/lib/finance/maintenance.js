// src/lib/finance/maintenance.js
//
// Finance module maintenance: TEST/PRODUCTION mode, and the "master reset" that
// wipes finance data to end a test run and start clean. Everything here is
// deliberately destructive and gated by callers to Admin/Console-admin only.
//
// Safety model:
//   • A reset ALWAYS can (and by default does) snapshot every collection it is
//     about to wipe into `finance_backups` (meta) + `finance_backup_items`
//     (one row per original document, preserving _id) so it can be restored.
//   • A small set of collections is PROTECTED and never wiped: the mode/settings
//     singleton, the backups themselves, and the append-only admin log — so the
//     record of what happened and the means to restore survive every reset.
//   • Reset and restore are plain sequential operations (not a single Mongo
//     transaction): backups can exceed transaction limits, and backup-first
//     ordering already makes the operation recoverable.
import { FinanceError } from './tx';

// The collections that make up the finance module's DATA. `reseed:'chart'`
// marks the chart of accounts, which the reset route re-seeds after wiping so
// the ledger is immediately usable again.
export const FINANCE_COLLECTIONS = [
  { name: 'org_funds', label: 'Ledger cashbook entries', group: 'Transactions' },
  { name: 'org_untransferred', label: 'Untransferred pool', group: 'Transactions' },
  { name: 'journal_entries', label: 'GL journal entries', group: 'Transactions' },
  { name: 'budgets', label: 'Budgets', group: 'Planning' },
  { name: 'grant_applications', label: 'Grant applications', group: 'Planning' },
  { name: 'vendors', label: 'Vendors', group: 'Payables' },
  { name: 'vendor_bills', label: 'Vendor bills', group: 'Payables' },
  { name: 'cost_centers', label: 'Cost centers', group: 'Config' },
  { name: 'fixed_assets', label: 'Fixed assets', group: 'Assets' },
  { name: 'compliance_items', label: 'Compliance items', group: 'Compliance' },
  { name: 'bank_statements', label: 'Bank statements', group: 'Bank' },
  { name: 'bank_txns', label: 'Bank transactions', group: 'Bank' },
  { name: 'fiscal_periods', label: 'Fiscal periods', group: 'Config' },
  { name: 'gl_accounts', label: 'Chart of accounts', group: 'Config', reseed: 'chart' },
  { name: 'fx_rates', label: 'FX rate cache', group: 'Cache' },
  { name: 'finance_audit_log', label: 'Finance audit log', group: 'Logs' },
  { name: 'finance_accounts', label: 'Billing accounts (incl. bank details)', group: 'Accounts' },
];

// Never wiped — these hold the mode, the backups, and the record of resets.
export const PROTECTED_COLLECTIONS = new Set([
  'finance_settings',
  'finance_backups',
  'finance_backup_items',
  'finance_admin_log',
]);

export const FINANCE_MODES = ['test', 'production'];
export const RESET_CONFIRM_PHRASE = 'RESET FINANCE';
const SETTINGS_ID = 'singleton';

const ALL_NAMES = new Set(FINANCE_COLLECTIONS.map((c) => c.name));

/** Validate a requested subset of collection names; default to all. Rejects protected/unknown. */
export function resolveResetCollections(names) {
  if (!Array.isArray(names) || names.length === 0) return FINANCE_COLLECTIONS.map((c) => c.name);
  const out = [];
  for (const n of names) {
    if (PROTECTED_COLLECTIONS.has(n)) throw new FinanceError(`Collection "${n}" is protected and cannot be reset`, 400);
    if (!ALL_NAMES.has(n)) throw new FinanceError(`Unknown finance collection: ${n}`, 400);
    out.push(n);
  }
  return out;
}

/** Read the finance settings singleton (mode). Defaults to test mode if unset. */
export async function getFinanceSettings(db) {
  const doc = await db.collection('finance_settings').findOne({ _id: SETTINGS_ID });
  return {
    mode: doc && FINANCE_MODES.includes(doc.mode) ? doc.mode : 'test',
    updatedAt: doc?.updatedAt || null,
    updatedBy: doc?.updatedBy || null,
    lastResetAt: doc?.lastResetAt || null,
    lastResetBy: doc?.lastResetBy || null,
    lastBackupId: doc?.lastBackupId || null,
  };
}

/** Set the finance mode (without wiping anything). */
export async function setFinanceMode(db, mode, actor) {
  if (!FINANCE_MODES.includes(mode)) throw new FinanceError('Invalid finance mode', 400);
  await db.collection('finance_settings').updateOne(
    { _id: SETTINGS_ID },
    { $set: { mode, updatedAt: new Date(), updatedBy: actor || null } },
    { upsert: true }
  );
  return getFinanceSettings(db);
}

/** Append to the protected admin log (survives resets). */
export async function logFinanceAdmin(db, entry) {
  try {
    await db.collection('finance_admin_log').insertOne({ ...entry, at: new Date() });
  } catch (e) {
    console.error('finance_admin_log write failed:', e && e.message);
  }
}

/**
 * Snapshot the given collections into finance_backups(+_items). Returns
 * { backupId, counts }. Copies documents verbatim (original _id preserved under
 * `doc`) in batches to stay well under BSON limits.
 */
export async function createBackup(db, { collections, actor, mode, note = '' }) {
  const backupMeta = {
    createdAt: new Date(),
    createdBy: actor || null,
    mode: mode || null,
    note: String(note || '').slice(0, 500),
    collections,
    counts: {},
    status: 'in_progress',
  };
  const metaRes = await db.collection('finance_backups').insertOne(backupMeta);
  const backupId = metaRes.insertedId;

  const counts = {};
  for (const coll of collections) {
    const cursor = db.collection(coll).find({});
    let batch = [];
    let total = 0;
    const flush = async () => {
      if (batch.length) {
        await db.collection('finance_backup_items').insertMany(
          batch.map((doc) => ({ backupId, coll, doc })),
          { ordered: false }
        );
        batch = [];
      }
    };
    for await (const doc of cursor) {
      batch.push(doc);
      total += 1;
      if (batch.length >= 500) {
        await flush();
      }
    }
    await flush();
    counts[coll] = total;
  }

  await db.collection('finance_backups').updateOne(
    { _id: backupId },
    { $set: { counts, status: 'complete', completedAt: new Date() } }
  );
  return { backupId, counts };
}

/** Wipe the given collections (deleteMany {}). Returns { coll: deletedCount }. */
export async function wipeCollections(db, collections) {
  const wiped = {};
  for (const coll of collections) {
    if (PROTECTED_COLLECTIONS.has(coll)) continue; // never
    const res = await db.collection(coll).deleteMany({});
    wiped[coll] = res.deletedCount || 0;
  }
  return wiped;
}

/**
 * Restore a backup: for every collection captured in the backup, wipe the live
 * collection and re-insert the snapshot (original _id preserved). Returns
 * { restored: {coll: count} }.
 */
export async function restoreBackup(db, backupId) {
  const meta = await db.collection('finance_backups').findOne({ _id: backupId });
  if (!meta) throw new FinanceError('Backup not found', 404);
  const collections = Array.isArray(meta.collections) ? meta.collections : [];
  const restored = {};
  for (const coll of collections) {
    if (PROTECTED_COLLECTIONS.has(coll)) continue;
    await db.collection(coll).deleteMany({});
    const cursor = db.collection('finance_backup_items').find({ backupId, coll });
    let batch = [];
    let total = 0;
    const flush = async () => {
      if (batch.length) {
        await db.collection(coll).insertMany(batch.map((it) => it.doc), { ordered: false });
        batch = [];
      }
    };
    for await (const it of cursor) {
      if (it && it.doc) {
        batch.push(it);
        total += 1;
        if (batch.length >= 500) {
            await flush();
        }
      }
    }
    await flush();
    restored[coll] = total;
  }
  return { restored };
}
