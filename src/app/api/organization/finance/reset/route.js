import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { actorFromUser } from '../../../../../lib/finance/audit';
import { seedChartOfAccounts } from '../../../../../lib/finance/gl';
import {
  getFinanceSettings,
  createBackup,
  wipeCollections,
  resolveResetCollections,
  logFinanceAdmin,
  RESET_CONFIRM_PHRASE,
  FINANCE_MODES,
} from '../../../../../lib/finance/maintenance';

// POST — MASTER FINANCE RESET. Destructive: wipes finance data to end a test
// run (or start another). Admin/Console-admin only. Requires an exact typed
// confirmation phrase. Backs up first by default so it can be restored.
//
// Body: {
//   confirmPhrase: "RESET FINANCE" (required, exact),
//   backup?: boolean (default true),
//   targetMode?: "test" | "production" (default: keep current),
//   collections?: string[] (subset of the manifest; default: all),
//   note?: string
// }
export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = (await request.json().catch(() => ({}))) || {};
    if (body.confirmPhrase !== RESET_CONFIRM_PHRASE) {
      return NextResponse.json(
        { error: `Confirmation failed. Type exactly "${RESET_CONFIRM_PHRASE}" to proceed.` },
        { status: 400 }
      );
    }

    let collections;
    try {
      collections = resolveResetCollections(body.collections);
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    const targetMode = body.targetMode;
    if (targetMode != null && !FINANCE_MODES.includes(targetMode)) {
      return NextResponse.json({ error: 'targetMode must be "test" or "production"' }, { status: 400 });
    }

    const doBackup = body.backup !== false; // default true
    const note = capString(body.note, 500);

    const client = await clientPromise;
    const db = client.db('resources');
    const actor = actorFromUser(user);

    const before = await getFinanceSettings(db);
    const mode = targetMode || before.mode;

    // 1) Snapshot first (recoverable if anything downstream fails).
    let backupId = null;
    let backupCounts = null;
    if (doBackup) {
      const b = await createBackup(db, { collections, actor, mode: before.mode, note: note || 'pre-reset backup' });
      backupId = b.backupId;
      backupCounts = b.counts;
    }

    // 2) Wipe.
    const wiped = await wipeCollections(db, collections);

    // 3) Re-seed the chart of accounts if it was part of the reset, so the GL is
    //    immediately usable again (fresh, no stale custom accounts).
    let chartReseeded = 0;
    if (collections.includes('gl_accounts')) {
      chartReseeded = await seedChartOfAccounts(db);
    }

    // 4) Record the new mode + reset metadata on the settings singleton.
    await db.collection('finance_settings').updateOne(
      { _id: 'singleton' },
      {
        $set: {
          mode,
          updatedAt: new Date(),
          updatedBy: actor,
          lastResetAt: new Date(),
          lastResetBy: actor,
          lastBackupId: backupId,
        },
      },
      { upsert: true }
    );

    // 5) Append to the protected admin log (survives the wipe).
    await logFinanceAdmin(db, {
      action: 'finance.reset',
      actor,
      collections,
      wiped,
      backupId: backupId ? String(backupId) : null,
      backedUp: doBackup,
      fromMode: before.mode,
      toMode: mode,
      note: note || null,
    });

    return NextResponse.json({
      success: true,
      mode,
      backedUp: doBackup,
      backupId: backupId ? String(backupId) : null,
      backupCounts,
      wiped,
      chartReseeded,
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/finance/reset error', e);
    return NextResponse.json({ error: 'Finance reset failed' }, { status: 500 });
  }
}
