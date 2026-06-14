// src/app/api/people/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { requireManageUsers, logActivity } from '../../../../lib/serverAuth';
import { ObjectId } from 'mongodb';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

// ─── GET — Fetch single person by _id ────────────────────────────────────────

export async function GET(req, { params }) {
  try {
    const auth = await requireManageUsers(req);
    if (auth.error) return auth.error;
    const { db } = auth;

    const oid = safeObjectId(params.id);
    if (!oid) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const person = await db.collection('people_records').findOne({ _id: oid });
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Join manager name from admin_users
    let managerName = null;
    if (person.managerId) {
      const manager = await db
        .collection('admin_users')
        .findOne(
          { _id: person.managerId },
          { projection: { firstName: 1, lastName: 1 } }
        );
      if (manager) {
        managerName = `${manager.firstName || ''} ${manager.lastName || ''}`.trim();
      }
    }

    // Join linked system user (admin_users) via systemUserId
    let systemUser = null;
    if (person.systemUserId) {
      const su = await db
        .collection('admin_users')
        .findOne(
          { _id: person.systemUserId },
          { projection: { username: 1, email: 1, role: 1, lastLogin: 1 } }
        );
      if (su) {
        systemUser = {
          _id: su._id,
          username: su.username,
          email: su.email,
          role: su.role,
          lastLogin: su.lastLogin || null,
        };
      }
    }

    return NextResponse.json({ person: { ...person, managerName, systemUser } });
  } catch (err) {
    console.error('[GET /api/people/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT — Update a person record ────────────────────────────────────────────

export async function PUT(req, { params }) {
  try {
    const auth = await requireManageUsers(req);
    if (auth.error) return auth.error;
    const { user, db } = auth;

    const oid = safeObjectId(params.id);
    if (!oid) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const existing = await db.collection('people_records').findOne({ _id: oid });
    if (!existing) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const body = await req.json();
    const now = new Date();
    const actor = user.username || user.email || 'system';

    // Fields that can be directly set
    const ALLOWED_FIELDS = [
      'firstName', 'lastName', 'email', 'personalEmail', 'phone', 'alternatePhone',
      'department', 'jobTitle', 'managerId',
      'exitDate', 'exitType', 'exitReason',
      'reHireEligible', 'reHireNotes',
      'systemUserId',
    ];

    const $set = { updatedAt: now };
    const $push = {};

    // Map allowed scalar/identity fields
    for (const field of ALLOWED_FIELDS) {
      if (body[field] === undefined) continue;

      if (field === 'managerId') {
        $set.managerId = body.managerId ? safeObjectId(body.managerId) : null;
      } else if (field === 'systemUserId') {
        $set.systemUserId = body.systemUserId ? safeObjectId(body.systemUserId) : null;
      } else if (field === 'exitDate') {
        $set.exitDate = body.exitDate ? new Date(body.exitDate) : null;
      } else if (field === 'reHireEligible') {
        $set.reHireEligible = Boolean(body.reHireEligible);
      } else if (field === 'email' || field === 'personalEmail') {
        $set[field] = body[field] ? body[field].toLowerCase().trim() : null;
      } else {
        $set[field] = body[field];
      }
    }

    // ── Status change ──────────────────────────────────────────────────────
    const VALID_STATUSES = ['active', 'suspended', 'alumni', 'archived'];
    if (body.status && VALID_STATUSES.includes(body.status) && body.status !== existing.status) {
      $set.status = body.status;

      // Sync status to the linked system account (admin_users) if it exists
      const systemUserId = existing.systemUserId || (body.systemUserId ? safeObjectId(body.systemUserId) : null);
      if (systemUserId) {
        let adminStatus = 'active';
        if (body.status === 'suspended') {
          adminStatus = 'suspended';
        } else if (body.status === 'alumni') {
          adminStatus = 'terminated';
        } else if (body.status === 'active') {
          adminStatus = 'active';
        }

        try {
          const userSet = { employmentStatus: adminStatus, updatedAt: now };
          if (adminStatus === 'terminated') {
            userSet.endDate = now;
          } else if (adminStatus === 'active') {
            userSet.endDate = null;
          }

          await db.collection('admin_users').updateOne(
            { _id: new ObjectId(systemUserId) },
            { $set: userSet }
          );
          console.log(`Synced people_record status change to system user: ${systemUserId} -> ${adminStatus}`);
        } catch (syncErr) {
          console.error(`Failed to sync status to system user ${systemUserId}:`, syncErr);
        }
      }

      const statusTimelineMap = {
        suspended: { event: 'status_suspended', description: 'Person status changed to suspended' },
        alumni:    { event: 'status_alumni',    description: 'Person marked as alumni' },
        archived:  { event: 'status_archived',  description: 'Person record archived' },
        active:    { event: 'status_activated', description: 'Person status restored to active' },
      };

      const tlEntry = statusTimelineMap[body.status];
      if (tlEntry) {
        $push.timeline = {
          $each: [{ date: now, event: tlEntry.event, description: tlEntry.description, by: actor }],
        };
      }
    }

    // ── Add a note ─────────────────────────────────────────────────────────
    if (body.addNote && body.addNote.text) {
      const newNote = {
        text: body.addNote.text,
        createdAt: now,
        createdBy: actor,
      };
      if ($push.notes) {
        $push.notes.$each.push(newNote);
      } else {
        $push.notes = { $each: [newNote] };
      }
    }

    // ── Add a timeline event ───────────────────────────────────────────────
    if (body.addTimelineEvent && body.addTimelineEvent.event) {
      const newTlEntry = {
        date: now,
        event: body.addTimelineEvent.event,
        description: body.addTimelineEvent.description || '',
        by: actor,
      };
      if ($push.timeline) {
        $push.timeline.$each.push(newTlEntry);
      } else {
        $push.timeline = { $each: [newTlEntry] };
      }
    }

    const updateOp = { $set };
    if (Object.keys($push).length > 0) updateOp.$push = $push;

    await db.collection('people_records').updateOne({ _id: oid }, updateOp);

    await logActivity(db, {
      action: 'people.update',
      actor: user,
      targetType: 'people',
      targetId: oid,
      targetName: `${existing.firstName} ${existing.lastName}`,
      metadata: { fields: Object.keys($set).filter((k) => k !== 'updatedAt') },
    });

    const updated = await db.collection('people_records').findOne({ _id: oid });
    return NextResponse.json({ success: true, person: updated });
  } catch (err) {
    console.error('[PUT /api/people/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE — Soft delete (archive) ──────────────────────────────────────────

export async function DELETE(req, { params }) {
  try {
    const auth = await requireManageUsers(req);
    if (auth.error) return auth.error;
    const { user, db } = auth;

    const oid = safeObjectId(params.id);
    if (!oid) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const existing = await db.collection('people_records').findOne({ _id: oid });
    if (!existing) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    if (existing.status === 'archived') {
      return NextResponse.json({ error: 'Person record is already archived' }, { status: 409 });
    }

    const now = new Date();
    const actor = user.username || user.email || 'system';

    await db.collection('people_records').updateOne(
      { _id: oid },
      {
        $set: { status: 'archived', updatedAt: now },
        $push: {
          timeline: {
            $each: [
              {
                date: now,
                event: 'record_archived',
                description: 'Person record soft-deleted (archived)',
                by: actor,
              },
            ],
          },
        },
      }
    );

    await logActivity(db, {
      action: 'people.archive',
      actor: user,
      targetType: 'people',
      targetId: oid,
      targetName: `${existing.firstName} ${existing.lastName}`,
      metadata: { previousStatus: existing.status },
    });

    return NextResponse.json({ success: true, message: 'Person record archived' });
  } catch (err) {
    console.error('[DELETE /api/people/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
