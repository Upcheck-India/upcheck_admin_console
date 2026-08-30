import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth, roomOf } from '../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/workflows/[id] - Get workflow status
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid workflow ID' }, { status: 400 });
    }

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
  },
  {
    requires: 'view',
    resolve: roomOf('dataroom_workflows', 'id'),
  },
);
