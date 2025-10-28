import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

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

export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const status = searchParams.get('status');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    
    const filter = { accountId };
    if (status) filter.status = status;

    const applications = await db.collection('grant_applications')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    // Calculate summary
    const summary = {
      total: applications.length,
      needToApply: applications.filter(a => a.status === 'need_to_apply').length,
      pending: applications.filter(a => a.status === 'pending').length,
      waiting: applications.filter(a => a.status === 'waiting').length,
      granted: applications.filter(a => a.status === 'granted').length,
      pendingTransfer: applications.filter(a => a.status === 'pending_transfer').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      totalGranted: applications
        .filter(a => a.status === 'granted' || a.status === 'pending_transfer')
        .reduce((sum, a) => sum + (a.amount || 0), 0),
      totalTransferred: applications
        .filter(a => a.transferred)
        .reduce((sum, a) => sum + (a.amount || 0), 0),
      untransferred: applications
        .filter(a => (a.status === 'granted' || a.status === 'pending_transfer') && !a.transferred)
        .reduce((sum, a) => sum + (a.amount || 0), 0),
    };

    return NextResponse.json({ applications, summary });
  } catch (e) {
    console.error('GET /api/organization/grant-applications error', e);
    return NextResponse.json({ error: 'Failed to fetch grant applications' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { 
      accountId, 
      programName, 
      organizationName, 
      amount, 
      applicationDate, 
      deadline,
      status, 
      notes,
      category,
      fundingPeriod,
      contactPerson,
      contactEmail,
    } = body || {};

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    if (!programName || typeof programName !== 'string') {
      return NextResponse.json({ error: 'programName is required' }, { status: 400 });
    }
    if (!organizationName || typeof organizationName !== 'string') {
      return NextResponse.json({ error: 'organizationName is required' }, { status: 400 });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    const doc = {
      accountId,
      programName: programName.trim(),
      organizationName: organizationName.trim(),
      amount: amt,
      applicationDate: applicationDate || null,
      deadline: deadline || null,
      status: status || 'need_to_apply',
      notes: notes || '',
      category: category || '',
      fundingPeriod: fundingPeriod || '',
      contactPerson: contactPerson || '',
      contactEmail: contactEmail || '',
      transferred: false,
      transferredAt: null,
      transferredToFundId: null,
      createdAt: new Date(),
      createdBy: {
        id: user._id?.toString?.() || null,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    };

    const client = await clientPromise;
    const db = client.db('resources');
    const res = await db.collection('grant_applications').insertOne(doc);
    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    console.error('POST /api/organization/grant-applications error', e);
    return NextResponse.json({ error: 'Failed to create grant application' }, { status: 500 });
  }
}
