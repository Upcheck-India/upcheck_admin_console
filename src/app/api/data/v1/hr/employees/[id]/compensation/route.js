// GET /api/data/v1/hr/employees/:id/compensation   scope: hr.compensation:read
//
// SENSITIVE. Employee compensation (salary/CTC) — served only to a token that
// holds the dedicated `hr.compensation:read` scope, and only through this
// endpoint (never embedded in the directory). :id is the Mongo id or username.
// Allowlisted via COMPENSATION_PROJECTION / shapeCompensation; unrelated fields
// cannot leak through.
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import {
  requireScope,
  COMPENSATION_PROJECTION,
  shapeCompensation,
  dataResponse,
} from '../../../../../../../../lib/oauth/resource';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { db, response } = await requireScope(request, 'hr.compensation:read');
  if (response) return response;

  const { id } = await params;
  const or = [{ username: id }];
  if (ObjectId.isValid(id)) or.unshift({ _id: new ObjectId(id) });

  const doc = await db.collection('admin_users').findOne({ $or: or }, { projection: COMPENSATION_PROJECTION });
  if (!doc) {
    return NextResponse.json(
      { error: 'not_found', error_description: 'No employee matches that id.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return dataResponse({ data: shapeCompensation(doc) });
}
