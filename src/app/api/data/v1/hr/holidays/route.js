// GET /api/data/v1/hr/holidays   scope: hr.calendar:read
//
// Read-only holiday calendar (org-wide reference data). Optional ?year= filter
// and ?type= (public|optional|company). Allowlisted fields only.
import {
  requireScope,
  shapeHoliday,
  parsePaging,
  pageMeta,
  dataResponse,
} from '../../../../../../lib/oauth/resource';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { db, response } = await requireScope(request, 'hr.calendar:read');
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const { limit, offset } = parsePaging(searchParams, { defLimit: 100, maxLimit: 366 });

  const query = {};
  const type = searchParams.get('type');
  if (type) query.type = type;
  const year = parseInt(searchParams.get('year'), 10);
  if (Number.isFinite(year)) {
    query.date = {
      $gte: new Date(Date.UTC(year, 0, 1)),
      $lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }

  const col = db.collection('holidays');
  const [total, docs] = await Promise.all([
    col.countDocuments(query),
    col.find(query).sort({ date: 1 }).skip(offset).limit(limit).toArray(),
  ]);

  const data = docs.map(shapeHoliday);
  return dataResponse({ data, page: pageMeta({ total, limit, offset, count: data.length }) });
}
