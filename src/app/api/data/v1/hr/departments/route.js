// GET /api/data/v1/hr/departments   scope: hr.departments:read
//
// Derived list of departments with headcount, aggregated from the employee
// directory. Safe org-structure data for building org charts / directories.
import { requireScope, dataResponse } from '../../../../../../lib/oauth/resource';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { db, response } = await requireScope(request, 'hr.departments:read');
  if (response) return response;

  const rows = await db
    .collection('admin_users')
    .aggregate([
      { $match: { department: { $nin: [null, ''] } } },
      { $group: { _id: '$department', headcount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const data = rows.map((r) => ({ name: r._id, headcount: r.headcount }));
  return dataResponse({ data, page: { total: data.length, count: data.length } });
}
