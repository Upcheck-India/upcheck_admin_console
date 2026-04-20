import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../lib/dataroom/audit-logger';

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

// POST /api/dataroom/workflows - Create approval workflow
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user || !isAdminLike(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      name, 
      documentId, 
      roomId, 
      workflowType = 'sequential', // sequential or parallel
      approvers,
      escalationHours,
      description
    } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Workflow name is required' }, { status: 400 });
    }

    if (!documentId || !ObjectId.isValid(documentId)) {
      return NextResponse.json({ error: 'Valid documentId required' }, { status: 400 });
    }

    if (!approvers || !Array.isArray(approvers) || approvers.length === 0) {
      return NextResponse.json({ error: 'At least one approver is required' }, { status: 400 });
    }

    if (!['sequential', 'parallel'].includes(workflowType)) {
      return NextResponse.json({ error: 'workflowType must be "sequential" or "parallel"' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify document exists
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(documentId),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Build workflow steps
    const steps = approvers.map((approver, index) => ({
      stepNumber: index + 1,
      approverEmail: approver.email,
      approverName: approver.name || approver.email,
      approverId: approver.userId ? new ObjectId(approver.userId) : null,
      status: 'pending', // pending, approved, rejected, skipped
      requiredAction: approver.action || 'approve', // approve, review, sign
      notes: '',
      actionTakenAt: null,
      actionTakenBy: null,
      escalated: false,
      escalationDeadline: escalationHours ? new Date(Date.now() + escalationHours * 3600000) : null,
    }));

    // For sequential workflows, only first step is active
    if (workflowType === 'sequential') {
      steps[0].status = 'active';
    } else {
      // For parallel, all steps are active
      steps.forEach(step => step.status = 'active');
    }

    const workflow = {
      name: name.trim(),
      description: description || '',
      documentId: new ObjectId(documentId),
      roomId: roomId ? new ObjectId(roomId) : document.roomId,
      workflowType,
      status: 'in_progress', // in_progress, completed, rejected, cancelled
      steps,
      currentStep: workflowType === 'sequential' ? 1 : null,
      totalSteps: steps.length,
      approvedSteps: 0,
      rejectedSteps: 0,
      escalationHours: escalationHours || null,
      completedAt: null,
      createdAt: new Date(),
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      updatedAt: new Date(),
    };

    const result = await db.collection('dataroom_workflows').insertOne(workflow);

    await logAudit({
      action: AUDIT_ACTIONS.WORKFLOW_CREATED,
      resourceType: 'workflow',
      resourceId: result.insertedId,
      roomId: workflow.roomId,
      user,
      details: {
        workflowName: name,
        documentId: documentId,
        workflowType,
        approverCount: approvers.length,
      },
      request,
    });

    return NextResponse.json({
      ...workflow,
      _id: result.insertedId,
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/workflows error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/dataroom/workflows - List workflows
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const roomId = searchParams.get('roomId');
    const status = searchParams.get('status');

    const client = await clientPromise;
    const db = client.db('resources');

    const filter = {};
    
    if (documentId && ObjectId.isValid(documentId)) {
      filter.documentId = new ObjectId(documentId);
    }
    
    if (roomId && ObjectId.isValid(roomId)) {
      filter.roomId = new ObjectId(roomId);
    }
    
    if (status) {
      filter.status = status;
    }

    const workflows = await db.collection('dataroom_workflows')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      count: workflows.length,
      workflows,
    });

  } catch (error) {
    console.error('GET /api/dataroom/workflows error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
