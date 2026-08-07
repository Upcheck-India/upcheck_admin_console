// GET /api/data/v1/hr/employees/:id   scope: hr.employees:read
//
// Single employee by Mongo id or username. Allowlisted fields only.
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import {
  requireScope,
  EMPLOYEE_PROJECTION,
  shapeEmployee,
  dataResponse,
} from '../../../../../../../lib/oauth/resource';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { db, response } = await requireScope(request, 'hr.employees:read');
  if (response) return response;

  const { id } = await params;
  const or = [{ username: id }];
  if (ObjectId.isValid(id)) or.unshift({ _id: new ObjectId(id) });

  const doc = await db.collection('admin_users').findOne({ $or: or }, { projection: EMPLOYEE_PROJECTION });
  if (!doc) {
    return NextResponse.json(
      { error: 'not_found', error_description: 'No employee matches that id.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return dataResponse({ data: shapeEmployee(doc) });
}
