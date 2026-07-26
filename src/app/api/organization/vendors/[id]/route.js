import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { requireFinanceAdmin, capString, capTags } from '../../../../../lib/finance/auth';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

const GSTIN_RE = /^[0-9A-Z]{15}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request, { params }) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const item = await db.collection('vendors').findOne({ _id: new ObjectId(id) });
    if (!item || item.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (e) {
    console.error('GET /api/organization/vendors/[id] error', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('vendors');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing || existing.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const name = capString(body?.name, 200);
    if (!name) return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });

    const email = capString(body?.email, 200);
    if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    const gstin = capString(body?.gstin, 20).toUpperCase();
    if (gstin && !GSTIN_RE.test(gstin)) return NextResponse.json({ error: 'Invalid GSTIN' }, { status: 400 });
    const pan = capString(body?.pan, 12).toUpperCase();
    if (pan && !PAN_RE.test(pan)) return NextResponse.json({ error: 'Invalid PAN' }, { status: 400 });

    const updateDoc = {
      name,
      contactPerson: capString(body?.contactPerson, 200),
      email,
      phone: capString(body?.phone, 40),
      gstin,
      pan,
      category: capString(body?.category, 60),
      address: capString(body?.address, 500),
      notes: capString(body?.notes, 2000),
      tags: capTags(body?.tags),
      updatedAt: new Date(),
      updatedBy: actorFromUser(user),
    };

    await col.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });
    await recordFinanceAudit(db, {
      action: 'vendor.update', collection: 'vendors', documentId: id,
      actor: actorFromUser(user), before: existing, after: { _id: existing._id, ...updateDoc },
    });

    return NextResponse.json({ _id: id, ...updateDoc });
  } catch (e) {
    console.error('PUT /api/organization/vendors/[id] error', e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('vendors');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ success: true, id, alreadyDeleted: true });

    // Referential integrity: block deletion while the vendor still has live,
    // unpaid bills (an open payable). Paid or cancelled bills don't block —
    // they're historical and remain linked by vendorId for the audit trail.
    const outstandingCount = await db.collection('vendor_bills').countDocuments({
      vendorId: id,
      deletedAt: { $exists: false },
      status: { $in: ['draft', 'approved'] },
    });
    if (outstandingCount > 0) {
      return NextResponse.json(
        { error: `Vendor has ${outstandingCount} outstanding bill(s). Pay or cancel them first.`, outstandingCount },
        { status: 409 }
      );
    }

    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date(), deletedBy: actorFromUser(user) } }
    );
    await recordFinanceAudit(db, {
      action: 'vendor.delete', collection: 'vendors', documentId: id,
      actor: actorFromUser(user), before: existing,
    });

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('DELETE /api/organization/vendors/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
