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
    const type = searchParams.get('type'); // 'actual' or 'mock'
    const fiscalYear = searchParams.get('fiscalYear');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    
    const filter = { accountId };
    if (type) filter.type = type;
    if (fiscalYear) filter.fiscalYear = fiscalYear;

    const budgets = await db.collection('budgets')
      .find(filter)
      .sort({ fiscalYear: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({ budgets });
  } catch (e) {
    console.error('GET /api/organization/budgets error', e);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
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
      name,
      fiscalYear,
      type, // 'actual' | 'mock' | 'available' | 'custom'
      budgetType, // 'annual_fiscal', 'project', 'monthly', 'service', 'custom'
      categories, // [{category, allocated, notes}]
      linkedGrants, // array of grant application IDs
      notes,
      baseAmount,
    } = body || {};

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!fiscalYear) {
      return NextResponse.json({ error: 'fiscalYear is required' }, { status: 400 });
    }
    if (!type || !['actual', 'mock', 'available', 'custom'].includes(type)) {
      return NextResponse.json({ error: 'type must be one of actual, mock, available, custom' }, { status: 400 });
    }
    if (!budgetType || !['annual_fiscal', 'project', 'monthly', 'service', 'custom'].includes(budgetType)) {
      return NextResponse.json({ error: 'budgetType must be annual_fiscal, project, monthly, service, or custom' }, { status: 400 });
    }

    const totalAllocated = (categories || []).reduce((sum, c) => sum + (Number(c.allocated) || 0), 0);
    const baseAmt = baseAmount != null ? Number(baseAmount) : undefined;
    if ((type === 'custom' || type === 'available') && (isNaN(baseAmt) || baseAmt < 0)) {
      // baseAmount is optional, but if provided for these types it must be valid
      if (baseAmount != null) {
        return NextResponse.json({ error: 'baseAmount must be a non-negative number' }, { status: 400 });
      }
    }

    const doc = {
      accountId,
      name: name.trim(),
      fiscalYear,
      type,
      budgetType,
      categories: categories || [],
      linkedGrants: linkedGrants || [],
      totalAllocated,
      ...(baseAmt != null ? { baseAmount: baseAmt } : {}),
      notes: notes || '',
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
    const res = await db.collection('budgets').insertOne(doc);
    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    console.error('POST /api/organization/budgets error', e);
    return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
  }
}
