import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../../lib/mongodb';
import { requireFinanceAdmin } from '../../../../../../lib/finance/auth';
import { actorFromUser } from '../../../../../../lib/finance/audit';
import { logFinanceAdmin } from '../../../../../../lib/finance/maintenance';

// GET — a single backup's metadata.
export async function GET(request, { params }) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;
    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    const client = await clientPromise;
    const db = client.db('resources');
    const b = await db.collection('finance_backups').findOne({ _id: new ObjectId(id) });
    if (!b) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    return NextResponse.json({
      id: String(b._id),
      createdAt: b.createdAt,
      createdBy: b.createdBy || null,
      mode: b.mode || null,
      note: b.note || '',
      status: b.status || 'complete',
      collections: b.collections || [],
      counts: b.counts || {},
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/finance/backups/[id] error', e);
    return NextResponse.json({ error: 'Failed to load backup' }, { status: 500 });
  }
}

// DELETE — prune a backup (its meta + all its snapshot items). Admin only.
export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;
    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    const client = await clientPromise;
    const db = client.db('resources');
    const backupId = new ObjectId(id);
    const meta = await db.collection('finance_backups').findOne({ _id: backupId }, { projection: { _id: 1 } });
    if (!meta) return NextResponse.json({ success: true, id, alreadyGone: true });
    const itemsRes = await db.collection('finance_backup_items').deleteMany({ backupId });
    await db.collection('finance_backups').deleteOne({ _id: backupId });
    await logFinanceAdmin(db, {
      action: 'finance.backup.delete', actor: actorFromUser(user),
      backupId: String(backupId), itemsDeleted: itemsRes.deletedCount || 0,
    });
    return NextResponse.json({ success: true, id, itemsDeleted: itemsRes.deletedCount || 0 });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('DELETE /api/organization/finance/backups/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete backup' }, { status: 500 });
  }
}
