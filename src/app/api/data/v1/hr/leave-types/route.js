// GET /api/data/v1/hr/leave-types   scope: hr.calendar:read
//
// Read-only leave-type catalogue (org-wide config: CL/SL/EL/LWP…). No individual
// leave records are ever exposed. Allowlisted fields only.
import { requireScope, shapeLeaveType, dataResponse } from '../../../../../../lib/oauth/resource';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { db, response } = await requireScope(request, 'hr.calendar:read');
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const query = includeInactive ? {} : { active: { $ne: false } };

  const docs = await db.collection('leave_types').find(query).sort({ name: 1 }).toArray();
  const data = docs.map(shapeLeaveType);
  return dataResponse({ data, page: { total: data.length, count: data.length } });
}
