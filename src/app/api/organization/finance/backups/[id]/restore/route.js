import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../../../lib/mongodb';
import { requireFinanceAdmin } from '../../../../../../../lib/finance/auth';
import { actorFromUser } from '../../../../../../../lib/finance/audit';
import { seedChartOfAccounts } from '../../../../../../../lib/finance/gl';
import {
  restoreBackup,
  createBackup,
  getFinanceSettings,
  logFinanceAdmin,
} from '../../../../../../../lib/finance/maintenance';

const RESTORE_CONFIRM_PHRASE = 'RESTORE FINANCE';

// POST — restore a backup. Destructive: overwrites the current finance data for
// every collection captured in the backup. Takes a safety snapshot of the
// current state FIRST, so a mistaken restore is itself reversible.
// Body: { confirmPhrase: "RESTORE FINANCE" }
export async function POST(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) || {};
    if (body.confirmPhrase !== RESTORE_CONFIRM_PHRASE) {
      return NextResponse.json(
        { error: `Confirmation failed. Type exactly "${RESTORE_CONFIRM_PHRASE}" to proceed.` },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const backupId = new ObjectId(id);
    const actor = actorFromUser(user);

    const meta = await db.collection('finance_backups').findOne({ _id: backupId });
    if (!meta) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    const collections = Array.isArray(meta.collections) ? meta.collections : [];
    if (collections.length === 0) {
      return NextResponse.json({ error: 'Backup has no collections to restore' }, { status: 400 });
    }

    const settings = await getFinanceSettings(db);

    // Safety snapshot of the CURRENT state before we overwrite it.
    const safety = await createBackup(db, {
      collections,
      actor,
      mode: settings.mode,
      note: `pre-restore safety (restoring backup ${String(backupId)})`,
    });

    const { restored } = await restoreBackup(db, backupId);

    // If the chart of accounts was restored, make sure the system chart is still
    // present (upsert is a no-op for accounts already restored).
    if (collections.includes('gl_accounts')) {
      await seedChartOfAccounts(db);
    }

    await logFinanceAdmin(db, {
      action: 'finance.restore', actor,
      backupId: String(backupId), safetyBackupId: String(safety.backupId), restored,
    });

    return NextResponse.json({
      success: true,
      restored,
      safetyBackupId: String(safety.backupId),
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/finance/backups/[id]/restore error', e);
    return NextResponse.json({ error: 'Finance restore failed' }, { status: 500 });
  }
}
