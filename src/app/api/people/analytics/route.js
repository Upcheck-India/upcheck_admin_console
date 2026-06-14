// src/app/api/people/analytics/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { requireManageUsers } from '../../../../lib/serverAuth';

// ─── GET — Aggregated analytics for the People Database ──────────────────────

export async function GET(req) {
  try {
    const auth = await requireManageUsers(req);
    if (auth.error) return auth.error;
    const { db } = auth;

    const col = db.collection('people_records');

    // ── 1. Summary counts ────────────────────────────────────────────────────
    // Run all summary counts in parallel via aggregation for efficiency
    const [summaryAgg, byDeptAgg, recentJoins, recentExits] = await Promise.all([

      // Summary: one-pass aggregation grouping by status and type
      col
        .aggregate([
          {
            $facet: {
              byStatus: [
                { $group: { _id: '$status', count: { $sum: 1 } } },
              ],
              byType: [
                { $group: { _id: '$type', count: { $sum: 1 } } },
              ],
              total: [
                { $count: 'n' },
              ],
            },
          },
        ])
        .toArray(),

      // By department
      col
        .aggregate([
          {
            $group: {
              _id: '$department',
              count: { $sum: 1 },
              active: {
                $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
              },
            },
          },
          { $sort: { count: -1 } },
          {
            $project: {
              _id: 0,
              department: { $ifNull: ['$_id', 'Unassigned'] },
              count: 1,
              active: 1,
            },
          },
        ])
        .toArray(),

      // Recent 5 joins (sorted by joinDate desc)
      col
        .find(
          { joinDate: { $exists: true, $ne: null } },
          {
            projection: {
              firstName: 1,
              lastName: 1,
              employeeId: 1,
              joinDate: 1,
              department: 1,
            },
          }
        )
        .sort({ joinDate: -1 })
        .limit(5)
        .toArray(),

      // Recent 5 exits (sorted by exitDate desc)
      col
        .find(
          { exitDate: { $exists: true, $ne: null } },
          {
            projection: {
              firstName: 1,
              lastName: 1,
              employeeId: 1,
              exitDate: 1,
              exitType: 1,
            },
          }
        )
        .sort({ exitDate: -1 })
        .limit(5)
        .toArray(),
    ]);

    // ── Build summary object ─────────────────────────────────────────────────
    const facet = summaryAgg[0] || { byStatus: [], byType: [], total: [] };

    const statusMap = Object.fromEntries(
      (facet.byStatus || []).map((s) => [s._id, s.count])
    );
    const typeMap = Object.fromEntries(
      (facet.byType || []).map((t) => [t._id, t.count])
    );
    const totalCount = facet.total?.[0]?.n ?? 0;

    const summary = {
      total:       totalCount,
      active:      statusMap['active']      || 0,
      alumni:      statusMap['alumni']      || 0,
      suspended:   statusMap['suspended']   || 0,
      archived:    statusMap['archived']    || 0,
      employees:   typeMap['employee']      || 0,
      interns:     typeMap['intern']        || 0,
      contractors: typeMap['contractor']    || 0,
    };

    return NextResponse.json({
      summary,
      byDepartment: byDeptAgg,
      recentJoins: recentJoins.map((p) => ({
        _id:        p._id,
        firstName:  p.firstName,
        lastName:   p.lastName,
        employeeId: p.employeeId,
        joinDate:   p.joinDate,
        department: p.department || null,
      })),
      recentExits: recentExits.map((p) => ({
        _id:        p._id,
        firstName:  p.firstName,
        lastName:   p.lastName,
        employeeId: p.employeeId,
        exitDate:   p.exitDate,
        exitType:   p.exitType || null,
      })),
    });
  } catch (err) {
    console.error('[GET /api/people/analytics]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
