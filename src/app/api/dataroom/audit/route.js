import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { withDataroomAuth, ADMIN_ROLES } from '../../../../lib/dataroom/withDataroomAuth';
import { queryAuditLogs } from '../../../../lib/dataroom/audit-logger';

// GET /api/dataroom/audit - Query audit logs
export const GET = withDataroomAuth(
  async (request, { user, params }) => {
  try {

    const { searchParams } = new URL(request.url);
    
    const filters = {};
    const action = searchParams.get('action');
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    const roomId = searchParams.get('roomId');
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (action) filters.action = action;
    if (resourceType) filters.resourceType = resourceType;
    if (resourceId) filters.resourceId = resourceId;
    if (roomId) filters.roomId = roomId;
    if (userId) filters.userId = userId;
    if (userEmail) filters.userEmail = userEmail;
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;

    const limit = Math.min(Number.parseInt(searchParams.get('limit') || '100', 10), 500);
    const skip = Number.parseInt(searchParams.get('skip') || '0', 10);

    const logs = await queryAuditLogs(filters, { limit, skip });

    const client = await clientPromise;
    const db = client.db('resources');
    const total = await db.collection('dataroom_audit_log').countDocuments(filters);

    return NextResponse.json({
      count: logs.length,
      total,
      limit,
      skip,
      filters,
      logs,
    });
  } catch (error) {
    console.error('GET /api/dataroom/audit error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
},
  { roles: ADMIN_ROLES },
);

// GET /api/dataroom/audit/user/[userId] would be a separate route
// For now, we can use query params: ?userId=xxx&summary=true

// POST /api/dataroom/audit/export - Export audit logs (placeholder)
export const POST = withDataroomAuth(
  async (request, { user, params }) => {
  try {

    const body = await request.json();
    const { roomId, fromDate, toDate, format = 'json' } = body;

    const filters = {};
    if (roomId) filters.roomId = roomId;
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;

    const logs = await queryAuditLogs(filters, { limit: 10000 });

    if (format === 'csv') {
      // Generate CSV
      const headers = ['timestamp', 'action', 'resourceType', 'resourceId', 'userId', 'userEmail', 'ip'];
      const rows = logs.map(log => [
        log.timestamp?.toISOString() || '',
        log.action || '',
        log.resourceType || '',
        log.resourceId || '',
        log.userId || '',
        log.userEmail || '',
        log.ip || '',
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit_log_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ count: logs.length, items: logs });
  } catch (error) {
    console.error('POST /api/dataroom/audit error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
},
  { roles: ADMIN_ROLES },
);
