import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
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

export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, fiscalYear, type, budgetType, categories, linkedGrants, notes, baseAmount, updatedBy } = body || {};

    const update = { updatedAt: new Date() };
    if (updatedBy) update.updatedBy = updatedBy;
    
    if (name !== undefined) update.name = name.trim();
    if (fiscalYear !== undefined) update.fiscalYear = fiscalYear;
    if (type !== undefined) {
      if (!['actual', 'mock', 'available', 'custom'].includes(type)) {
        return NextResponse.json({ error: 'type must be one of actual, mock, available, custom' }, { status: 400 });
      }
      update.type = type;
    }
    if (budgetType !== undefined) update.budgetType = budgetType;
    if (linkedGrants !== undefined) update.linkedGrants = linkedGrants;
    if (categories !== undefined) {
      update.categories = categories;
      update.totalAllocated = categories.reduce((sum, c) => sum + (Number(c.allocated) || 0), 0);
    }
    if (notes !== undefined) update.notes = notes;
    if (baseAmount !== undefined) {
      const n = Number(baseAmount);
      if (isNaN(n) || n < 0) {
        return NextResponse.json({ error: 'baseAmount must be a non-negative number' }, { status: 400 });
      }
      update.baseAmount = n;
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const res = await db.collection('budgets').updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );

    if (!res.matchedCount) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ _id: id, ...update });
  } catch (e) {
    console.error('PUT /api/organization/budgets/[id] error', e);
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const res = await db.collection('budgets').deleteOne({ _id: new ObjectId(id) });

    if (!res.deletedCount) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('DELETE /api/organization/budgets/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
