// GET /api/data/v1/hr/employees   scope: hr.employees:read
//
// Read-only employee directory. Non-sensitive, allowlisted fields only (see
// EMPLOYEE_PROJECTION / shapeEmployee in lib/oauth/resource.js). Supports
// filtering by department and employmentStatus, a name/email search, and
// offset/limit pagination.
import {
  requireScope,
  EMPLOYEE_PROJECTION,
  shapeEmployee,
  parsePaging,
  pageMeta,
  escapeRegex,
  dataResponse,
} from '../../../../../../lib/oauth/resource';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { db, response } = await requireScope(request, 'hr.employees:read');
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const { limit, offset } = parsePaging(searchParams);

  const query = {};
  const department = searchParams.get('department');
  if (department) query.department = department;
  const status = searchParams.get('status');
  if (status) query.employmentStatus = status;
  const q = (searchParams.get('q') || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    query.$or = [{ firstName: rx }, { lastName: rx }, { username: rx }, { email: rx }];
  }

  const col = db.collection('admin_users');
  const [total, docs] = await Promise.all([
    col.countDocuments(query),
    col
      .find(query, { projection: EMPLOYEE_PROJECTION })
      .sort({ firstName: 1, lastName: 1, _id: 1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
  ]);

  const data = docs.map(shapeEmployee);
  return dataResponse({ data, page: pageMeta({ total, limit, offset, count: data.length }) });
}
