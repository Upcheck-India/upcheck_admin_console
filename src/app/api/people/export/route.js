// src/app/api/people/export/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { requireManageUsers } from '../../../../lib/serverAuth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CSV_FIELDS = [
  'employeeId',
  'firstName',
  'lastName',
  'email',
  'personalEmail',
  'phone',
  'type',
  'status',
  'department',
  'jobTitle',
  'joinDate',
  'exitDate',
  'exitType',
  'exitReason',
  'reHireEligible',
  'createdAt',
];

/**
 * Escape a value for CSV: wrap in double-quotes if it contains a comma,
 * newline, or double-quote; escape internal double-quotes by doubling them.
 */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(val) {
  if (!val) return '';
  try {
    return new Date(val).toISOString();
  } catch {
    return String(val);
  }
}

function buildCsv(records) {
  const header = CSV_FIELDS.join(',');
  const rows = records.map((r) => {
    return CSV_FIELDS.map((field) => {
      let val = r[field];
      if (field === 'joinDate' || field === 'exitDate' || field === 'createdAt') {
        val = formatDate(val);
      }
      return csvEscape(val);
    }).join(',');
  });
  return [header, ...rows].join('\r\n');
}

// ─── GET — Export people records ─────────────────────────────────────────────

export async function GET(req) {
  try {
    const auth = await requireManageUsers(req);
    if (auth.error) return auth.error;
    const { db } = auth;

    const { searchParams } = new URL(req.url);

    const format     = searchParams.get('format') === 'json' ? 'json' : 'csv';
    const status     = searchParams.get('status');
    const type       = searchParams.get('type');
    const department = searchParams.get('department');
    const search     = searchParams.get('search');

    // Build filter (mirrors /api/people GET, no pagination)
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

    // Cap at 10 000 records
    const records = await db
      .collection('people_records')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(10000)
      .toArray();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'json') {
      const json = JSON.stringify(records, null, 2);
      return new NextResponse(json, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="people-export-${timestamp}.json"`,
        },
      });
    }

    // CSV
    const csv = buildCsv(records);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="people-export-${timestamp}.csv"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/people/export]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
