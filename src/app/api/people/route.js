// src/app/api/people/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { requireManageUsers, logActivity } from '../../../lib/serverAuth';
import { ObjectId } from 'mongodb';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Atomically generates the next employee ID for a given type.
 * Uses a `counters` collection to avoid race conditions.
 */
async function generateEmployeeId(db, type) {
  const counterKey = type === 'intern' ? 'utint_counter' : 'utemp_counter';
  const counter = await db.collection('counters').findOneAndUpdate(
    { _id: counterKey },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const num = String(counter.seq).padStart(5, '0');
  return type === 'intern' ? `UTINT-${num}` : `UTEMP-${num}`;
}

// ─── POST — Create a person record ───────────────────────────────────────────

export async function POST(req) {
  try {
    const auth = await requireManageUsers(req);
    if (auth.error) return auth.error;
    const { user, db } = auth;

    const body = await req.json();

    const {
      type,
      firstName,
      lastName,
      email,
      personalEmail,
      phone,
      alternatePhone,
      department,
      jobTitle,
      managerId,
      joinDate,
      exitDate,
      exitType,
      exitReason,
      reHireEligible,
      reHireNotes,
      systemUserId,
      notes,
    } = body;

    // Validation
    if (!type || !['employee', 'intern', 'contractor'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be one of: employee, intern, contractor' },
        { status: 400 }
      );
    }
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'firstName and lastName are required' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    // Check email uniqueness in people_records
    const existingEmail = await db.collection('people_records').findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return NextResponse.json({ error: 'A person with this email already exists' }, { status: 409 });
    }

    // Validate systemUserId existence if provided
    if (systemUserId) {
      const parsedSystemUserId = safeObjectId(systemUserId);
      if (!parsedSystemUserId) {
        return NextResponse.json({ error: 'Invalid systemUserId format' }, { status: 400 });
      }
      const systemUserExists = await db.collection('admin_users').findOne({ _id: parsedSystemUserId });
      if (!systemUserExists) {
        return NextResponse.json({ error: 'System account not found' }, { status: 400 });
      }
    }

    // Atomically generate employee ID
    const employeeId = await generateEmployeeId(db, type);

    // Add safeObjectId helper locally if not present, but wait, we already imported ObjectId. Let's make a local helper:
    function safeObjectId(id) {
      try { return new ObjectId(id); } catch { return null; }
    }

    const now = new Date();

    const personRecord = {
      employeeId,
      type,
      status: body.status && ['active', 'suspended', 'alumni', 'archived'].includes(body.status)
        ? body.status
        : 'active',
      // Identity
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      personalEmail: personalEmail?.toLowerCase().trim() || null,
      phone: phone || null,
      alternatePhone: alternatePhone || null,
      // Org
      department: department || null,
      jobTitle: jobTitle || null,
      managerId: managerId ? new ObjectId(managerId) : null,
      // Lifecycle
      joinDate: joinDate ? new Date(joinDate) : now,
      exitDate: exitDate ? new Date(exitDate) : null,
      exitType: exitType || null,
      exitReason: exitReason || null,
      reHireEligible: reHireEligible !== undefined ? Boolean(reHireEligible) : true,
      reHireNotes: reHireNotes || null,
      // System account link
      systemUserId: systemUserId ? new ObjectId(systemUserId) : null,
      // Timeline — seed with a "created" event
      timeline: [
        {
          date: now,
          event: 'record_created',
          description: `Person record created`,
          by: user.username || user.email || 'system',
        },
      ],
      // Notes
      notes: Array.isArray(notes)
        ? notes.map((n) => ({
            text: n.text,
            createdAt: now,
            createdBy: user.username || user.email || 'system',
          }))
        : [],
      // Timestamps
      createdAt: now,
      updatedAt: now,
      createdBy: user._id || null,
    };

    const result = await db.collection('people_records').insertOne(personRecord);

    await logActivity(db, {
      action: 'people.create',
      actor: user,
      targetType: 'people',
      targetId: result.insertedId,
      targetName: `${firstName} ${lastName}`,
      metadata: { employeeId, type },
    });

    return NextResponse.json(
      { success: true, personId: result.insertedId, employeeId },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/people]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── GET — List people with filters & pagination ─────────────────────────────

export async function GET(req) {
  try {
    const auth = await requireManageUsers(req);
    if (auth.error) return auth.error;
    const { db } = auth;

    const { searchParams } = new URL(req.url);

    const status     = searchParams.get('status');
    const type       = searchParams.get('type');
    const department = searchParams.get('department');
    const search     = searchParams.get('search');
    const dateFrom   = searchParams.get('dateFrom');
    const dateTo     = searchParams.get('dateTo');
    const page       = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit      = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    // Build MongoDB filter
    const filter = {};

    if (status && ['active', 'suspended', 'alumni', 'archived'].includes(status)) {
      filter.status = status;
    }
    if (type && ['employee', 'intern', 'contractor'].includes(type)) {
      filter.type = type;
    }
    if (department) {
      filter.department = { $regex: department, $options: 'i' };
    }
    if (search) {
      const regex = { $regex: search, $options: 'i' };
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { employeeId: regex },
      ];
    }
    if (dateFrom || dateTo) {
      filter.joinDate = {};
      if (dateFrom) filter.joinDate.$gte = new Date(dateFrom);
      if (dateTo)   filter.joinDate.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;

    const [people, total] = await Promise.all([
      db.collection('people_records')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('people_records').countDocuments(filter),
    ]);

    // Join manager names from admin_users for records that have a managerId
    const managerIds = [
      ...new Set(
        people
          .filter((p) => p.managerId)
          .map((p) => p.managerId.toString())
      ),
    ].map((id) => new ObjectId(id));

    let managerMap = {};
    if (managerIds.length > 0) {
      const managers = await db
        .collection('admin_users')
        .find(
          { _id: { $in: managerIds } },
          { projection: { firstName: 1, lastName: 1 } }
        )
        .toArray();
      managerMap = Object.fromEntries(
        managers.map((m) => [
          m._id.toString(),
          `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        ])
      );
    }

    const enriched = people.map((p) => ({
      ...p,
      managerName: p.managerId ? managerMap[p.managerId.toString()] || null : null,
    }));

    return NextResponse.json({
      people: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[GET /api/people]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
