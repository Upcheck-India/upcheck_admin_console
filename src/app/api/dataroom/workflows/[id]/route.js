import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';

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

// GET /api/dataroom/workflows/[id] - Get workflow status
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid workflow ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const workflow = await db.collection('dataroom_workflows').findOne({
      _id: new ObjectId(id),
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Calculate progress
    const progress = {
      totalSteps: workflow.totalSteps,
      completedSteps: workflow.steps.filter(s => s.status === 'approved' || s.status === 'rejected').length,
      pendingSteps: workflow.steps.filter(s => s.status === 'pending' || s.status === 'active').length,
      approvedSteps: workflow.approvedSteps,
      rejectedSteps: workflow.rejectedSteps,
      percentComplete: Math.round((workflow.approvedSteps / workflow.totalSteps) * 100),
    };

    return NextResponse.json({
      ...workflow,
      progress,
    });

  } catch (error) {
    console.error('GET /api/dataroom/workflows/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
