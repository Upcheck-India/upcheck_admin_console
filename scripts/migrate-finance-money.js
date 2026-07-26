// scripts/migrate-finance-money.js
//
// One-time, idempotent backfill of integer-paise (`*Minor`) fields on existing
// finance documents. The application already reads paise tolerantly (legacy
// docs are converted on the fly via minorExpr / readMinor), so running this is
// not required for correctness — it just makes the canonical field present so
// future reads/aggregations are exact and index-friendly.
//
// Usage:  node scripts/migrate-finance-money.js [--commit]
//   (dry-run by default; pass --commit to write)
//
// Requires MONGODB_URI in the environment (.env.local is loaded if present).

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const COMMIT = process.argv.includes('--commit');
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

const round2 = (n) => Math.round((Number(n) || 0) * 100);

async function backfillSimple(db, collection, fields) {
  const col = db.collection(collection);
  let scanned = 0;
  let updated = 0;
  const cursor = col.find({});
  for await (const doc of cursor) {
    scanned += 1;
    const set = {};
    for (const f of fields) {
      const minorField = `${f}Minor`;
      if (doc[minorField] == null && doc[f] != null && Number.isFinite(Number(doc[f]))) {
        set[minorField] = round2(doc[f]);
      }
    }
    if (Object.keys(set).length) {
      updated += 1;
      if (COMMIT) await col.updateOne({ _id: doc._id }, { $set: set });
    }
  }
  console.log(`${collection}: scanned ${scanned}, ${COMMIT ? 'updated' : 'would update'} ${updated}`);
}

async function backfillBudgets(db) {
  const col = db.collection('budgets');
  let scanned = 0;
  let updated = 0;
  for await (const doc of col.find({})) {
    scanned += 1;
    const set = {};
    if (doc.totalAllocatedMinor == null && doc.totalAllocated != null) set.totalAllocatedMinor = round2(doc.totalAllocated);
    if (doc.baseAmountMinor == null && doc.baseAmount != null) set.baseAmountMinor = round2(doc.baseAmount);
    if (Array.isArray(doc.categories)) {
      const cats = doc.categories.map((c) => (
        c && c.allocatedMinor == null && c.allocated != null
          ? { ...c, allocated: Number(c.allocated) || 0, allocatedMinor: round2(c.allocated) }
          : c
      ));
      const changed = JSON.stringify(cats) !== JSON.stringify(doc.categories);
      if (changed) set.categories = cats;
    }
    if (Object.keys(set).length) {
      updated += 1;
      if (COMMIT) await col.updateOne({ _id: doc._id }, { $set: set });
    }
  }
  console.log(`budgets: scanned ${scanned}, ${COMMIT ? 'updated' : 'would update'} ${updated}`);
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('resources');
  console.log(`Finance money backfill — ${COMMIT ? 'COMMIT' : 'DRY RUN'}`);
  await backfillSimple(db, 'org_funds', ['amount']);
  await backfillSimple(db, 'org_untransferred', ['amount', 'remainingAmount']);
  await backfillSimple(db, 'grant_applications', ['amount']);
  await backfillBudgets(db);
  await client.close();
  if (!COMMIT) console.log('\nDry run complete. Re-run with --commit to apply.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
