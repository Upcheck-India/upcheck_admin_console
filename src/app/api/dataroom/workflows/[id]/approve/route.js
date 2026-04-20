import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';

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

// POST /api/dataroom/workflows/[id]/approve - Approve workflow step
export async function POST(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid workflow ID' }, { status: 400 });
    }

    const body = await request.json();
    const { stepNumber, notes } = body;

    if (!stepNumber || stepNumber < 1) {
      return NextResponse.json({ error: 'Valid stepNumber required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const workflow = await db.collection('dataroom_workflows').findOne({
      _id: new ObjectId(id),
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (workflow.status !== 'in_progress') {
      return NextResponse.json({ error: 'Workflow is not active' }, { status: 400 });
    }

    const step = workflow.steps[stepNumber - 1];
    if (!step) {
      return NextResponse.json({ error: 'Invalid step number' }, { status: 400 });
    }

    // Verify user is the approver for this step
    if (step.approverEmail !== user.email && step.approverId?.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'You are not authorized to approve this step' }, { status: 403 });
    }

    if (step.status !== 'active' && step.status !== 'pending') {
      return NextResponse.json({ error: 'This step has already been processed' }, { status: 400 });
    }

    // Update the step
    workflow.steps[stepNumber - 1].status = 'approved';
    workflow.steps[stepNumber - 1].notes = notes || '';
    workflow.steps[stepNumber - 1].actionTakenAt = new Date();
    workflow.steps[stepNumber - 1].actionTakenBy = {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
    };

    workflow.approvedSteps += 1;

    // For sequential workflows, activate next step
    if (workflow.workflowType === 'sequential') {
      const nextStep = workflow.steps[stepNumber];
      if (nextStep) {
        nextStep.status = 'active';
        workflow.currentStep = stepNumber + 1;
      } else {
        // All steps approved
        workflow.status = 'completed';
        workflow.completedAt = new Date();
      }
    } else {
      // For parallel, check if all approved
      const allApproved = workflow.steps.every(s => s.status === 'approved');
      if (allApproved) {
        workflow.status = 'completed';
        workflow.completedAt = new Date();
      }
    }

    workflow.updatedAt = new Date();

    await db.collection('dataroom_workflows').updateOne(
      { _id: new ObjectId(id) },
      { $set: workflow }
    );

    await logAudit({
      action: AUDIT_ACTIONS.WORKFLOW_APPROVED,
      resourceType: 'workflow',
      resourceId: new ObjectId(id),
      roomId: workflow.roomId,
      user,
      details: {
        workflowName: workflow.name,
        stepNumber,
        notes,
        workflowCompleted: workflow.status === 'completed',
      },
      request,
    });

    return NextResponse.json({
      message: 'Workflow step approved successfully',
      workflow,
    });

  } catch (error) {
    console.error('POST /api/dataroom/workflows/[id]/approve error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
