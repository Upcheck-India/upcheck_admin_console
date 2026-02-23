import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { queryAuditLogs } from '../../../../lib/dataroom/audit-logger';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user;
  } catch {
    return null;
  }
}

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

// GET /api/dataroom/audit - Query audit logs
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
}

// GET /api/dataroom/audit/user/[userId] would be a separate route
// For now, we can use query params: ?userId=xxx&summary=true

// POST /api/dataroom/audit/export - Export audit logs (placeholder)
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
}
