import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { escapeRegex } from '../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, capTags, parseLimit } from '../../../../lib/finance/auth';
import { minorExpr, fromMinor } from '../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';

// Light-touch format validation. We store what admins enter but reject values
// that are obviously malformed so downstream reporting/GST filings stay clean.
const GSTIN_RE = /^[0-9A-Z]{15}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const limit = parseLimit(searchParams.get('limit'), { def: 200, max: 1000 });
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);

    const filter = { deletedAt: { $exists: false } };
    if (category) filter.category = category;
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { contactPerson: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
        { gstin: { $regex: safe, $options: 'i' } },
        { pan: { $regex: safe, $options: 'i' } },
      ];
    }

    const col = db.collection('vendors');
    const totalCount = await col.countDocuments(filter);

    // List page + per-vendor open payables (draft/approved bills that are not
    // deleted). vendor_bills.vendorId stores the string form of the vendor _id.
    const rows = await col.aggregate([
      { $match: filter },
      { $sort: { name: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'vendor_bills',
          let: { vid: { $toString: '$_id' } },
          pipeline: [
            {
              $match: {
                deletedAt: { $exists: false },
                status: { $in: ['draft', 'approved'] },
                $expr: { $eq: ['$vendorId', '$$vid'] },
              },
            },
            { $group: { _id: null, outstandingMinor: { $sum: minorExpr('amount') }, count: { $sum: 1 } } },
          ],
          as: 'ap',
        },
      },
      {
        $addFields: {
          outstandingMinor: { $ifNull: [{ $arrayElemAt: ['$ap.outstandingMinor', 0] }, 0] },
          outstandingCount: { $ifNull: [{ $arrayElemAt: ['$ap.count', 0] }, 0] },
        },
      },
      { $project: { ap: 0 } },
    ]).toArray();

    const items = rows.map((v) => ({
      ...v,
      outstanding: fromMinor(v.outstandingMinor || 0),
    }));

    return NextResponse.json({
      items,
      pagination: { total: totalCount, skip, limit, returned: items.length },
    });
  } catch (e) {
    console.error('GET /api/organization/vendors error', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json();
    const name = capString(body?.name, 200);
    if (!name) return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });

    const email = capString(body?.email, 200);
    if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    const gstin = capString(body?.gstin, 20).toUpperCase();
    if (gstin && !GSTIN_RE.test(gstin)) return NextResponse.json({ error: 'Invalid GSTIN' }, { status: 400 });
    const pan = capString(body?.pan, 12).toUpperCase();
    if (pan && !PAN_RE.test(pan)) return NextResponse.json({ error: 'Invalid PAN' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');

    const doc = {
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
      createdAt: new Date(),
      createdBy: actorFromUser(user),
    };

    const res = await db.collection('vendors').insertOne(doc);
    await recordFinanceAudit(db, {
      action: 'vendor.create', collection: 'vendors', documentId: res.insertedId,
      actor: actorFromUser(user), after: doc, meta: { name },
    });

    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    console.error('POST /api/organization/vendors error', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
