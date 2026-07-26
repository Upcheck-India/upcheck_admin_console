import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { requireFinanceAdmin } from '../../../../../lib/finance/auth';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';
import {
  getFinanceSettings,
  setFinanceMode,
  logFinanceAdmin,
  FINANCE_COLLECTIONS,
  FINANCE_MODES,
} from '../../../../../lib/finance/maintenance';

// GET — current finance mode/settings + the collection manifest (for the reset UI).
export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;
    const client = await clientPromise;
    const db = client.db('resources');
    const settings = await getFinanceSettings(db);
    return NextResponse.json({ settings, modes: FINANCE_MODES, collections: FINANCE_COLLECTIONS });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/finance/settings error', e);
    return NextResponse.json({ error: 'Failed to load finance settings' }, { status: 500 });
  }
}

// PUT — switch mode (test <-> production) WITHOUT wiping any data.
export async function PUT(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;
    const body = await request.json();
    const mode = body?.mode;
    if (!FINANCE_MODES.includes(mode)) {
      return NextResponse.json({ error: 'mode must be "test" or "production"' }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db('resources');
    const actor = actorFromUser(user);
    const before = await getFinanceSettings(db);
    const settings = await setFinanceMode(db, mode, actor);
    await logFinanceAdmin(db, { action: 'finance.mode.change', actor, from: before.mode, to: mode });
    await recordFinanceAudit(db, {
      action: 'finance.mode.change', collection: 'finance_settings', documentId: 'singleton',
      actor, before: { mode: before.mode }, after: { mode },
    });
    return NextResponse.json({ settings });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('PUT /api/organization/finance/settings error', e);
    return NextResponse.json({ error: 'Failed to update finance mode' }, { status: 500 });
  }
}
