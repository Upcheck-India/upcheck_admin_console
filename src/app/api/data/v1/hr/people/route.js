// GET /api/data/v1/hr/people   scope: hr.people:read
//
// Read-only people/roster records (employees, interns, contractors). Allowlisted
// fields only — excludes personal contact info, exit reasons, notes and timeline.
import {
  requireScope,
  PEOPLE_PROJECTION,
  shapePerson,
  parsePaging,
  pageMeta,
  escapeRegex,
  dataResponse,
} from '../../../../../../lib/oauth/resource';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { db, response } = await requireScope(request, 'hr.people:read');
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const { limit, offset } = parsePaging(searchParams);

  const query = {};
  const type = searchParams.get('type');
  if (type) query.type = type;
  const status = searchParams.get('status');
  if (status) query.status = status;
  const department = searchParams.get('department');
  if (department) query.department = department;
  const q = (searchParams.get('q') || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    query.$or = [{ firstName: rx }, { lastName: rx }, { employeeId: rx }, { email: rx }];
  }

  const col = db.collection('people_records');
  const [total, docs] = await Promise.all([
    col.countDocuments(query),
    col
      .find(query, { projection: PEOPLE_PROJECTION })
      .sort({ employeeId: 1, _id: 1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
  ]);

  const data = docs.map(shapePerson);
  return dataResponse({ data, page: pageMeta({ total, limit, offset, count: data.length }) });
}
