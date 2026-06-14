// src/app/api/people/migrate/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { requireAuth, logActivity } from '../../../../lib/serverAuth';
import { ObjectId } from 'mongodb';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Atomically generates the next employee ID for a given type.
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

/**
 * Map admin_users employmentStatus → people_records status.
 */
function mapStatus(employmentStatus) {
  switch (employmentStatus) {
    case 'active':      return 'active';
    case 'terminated':  return 'alumni';
    case 'suspended':   return 'suspended';
    case 'on_leave':    return 'active';
    default:            return 'active';
  }
}

// ─── POST — Migrate admin_users → people_records ─────────────────────────────

export async function POST(req) {
  try {
    // Only Console admins may run this migration
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const { user, db } = auth;

    if (user.role !== 'Console admin') {
      return NextResponse.json(
        { error: 'Forbidden: Console admin role required' },
        { status: 403 }
      );
    }

    // 1. Fetch all admin_users
    const allUsers = await db.collection('admin_users').find({}).toArray();
    const total = allUsers.length;

    let migrated = 0;
    let skipped = 0;
    const errors = [];

    for (const adminUser of allUsers) {
      try {
        // 2. Skip if a people_records entry already links to this user
        const existing = await db
          .collection('people_records')
          .findOne({ systemUserId: adminUser._id });

        if (existing) {
          skipped++;
          continue;
        }

        // 3. Determine person type
        const isIntern =
          adminUser.role === 'Intern' ||
          adminUser.employmentType === 'intern';
        const type = isIntern ? 'intern' : 'employee';

        // 4. Generate atomic employee ID
        const employeeId = await generateEmployeeId(db, type);

        const now = new Date();
        const actor = user.username || user.email || 'system';

        // 5. Build person record from admin_users fields
        const personRecord = {
          employeeId,
          type,
          status: mapStatus(adminUser.employmentStatus),
          // Identity
          firstName:      adminUser.firstName  || '',
          lastName:       adminUser.lastName   || '',
          email:          (adminUser.email || '').toLowerCase().trim(),
          personalEmail:  adminUser.personalEmail || null,
          phone:          adminUser.phone       || null,
          alternatePhone: null,
          // Org
          department: adminUser.department || null,
          jobTitle:   adminUser.jobTitle   || null,
          managerId:  adminUser.managerId
            ? (adminUser.managerId instanceof ObjectId
                ? adminUser.managerId
                : new ObjectId(adminUser.managerId))
            : null,
          // Lifecycle — admin_users uses startDate / endDate
          joinDate: adminUser.startDate ? new Date(adminUser.startDate) : null,
          exitDate: adminUser.endDate   ? new Date(adminUser.endDate)   : null,
          exitType:         null,
          exitReason:       null,
          reHireEligible:   true,
          reHireNotes:      null,
          // Link back to admin_users record
          systemUserId: adminUser._id,
          // Timeline
          timeline: [
            {
              date: now,
              event: 'migrated_from_admin_users',
              description: `Migrated from admin_users (id: ${adminUser._id})`,
              by: actor,
            },
          ],
          // Notes
          notes: [],
          // Timestamps
          createdAt: adminUser.createdAt || now,
          updatedAt: now,
          createdBy: user._id || null,
        };

        // 6. Insert into people_records
        const result = await db.collection('people_records').insertOne(personRecord);

        // 7. Back-link admin_users → new people record
        await db.collection('admin_users').updateOne(
          { _id: adminUser._id },
          { $set: { peopleRecordId: result.insertedId } }
        );

        migrated++;
      } catch (userErr) {
        console.error(`[migrate] Error processing user ${adminUser._id}:`, userErr);
        errors.push({ userId: String(adminUser._id), error: userErr.message });
      }
    }

    await logActivity(db, {
      action: 'people.migrate',
      actor: user,
      targetType: 'people',
      targetId: null,
      targetName: 'bulk migration',
      metadata: { migrated, skipped, total, errorCount: errors.length },
    });

    const response = { migrated, skipped, total };
    if (errors.length > 0) response.errors = errors;

    return NextResponse.json(response);
  } catch (err) {
    console.error('[POST /api/people/migrate]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
