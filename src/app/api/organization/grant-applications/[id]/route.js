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
    const { 
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
      transferred,
      transferredToFundId,
      receivedToOrg,
      untransferredId,
    } = body || {};

    const update = { updatedAt: new Date() };
    
    if (programName !== undefined) update.programName = programName.trim();
    if (organizationName !== undefined) update.organizationName = organizationName.trim();
    if (amount !== undefined) {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }
      update.amount = amt;
    }
    if (applicationDate !== undefined) update.applicationDate = applicationDate;
    if (deadline !== undefined) update.deadline = deadline;
    if (status !== undefined) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (category !== undefined) update.category = category;
    if (fundingPeriod !== undefined) update.fundingPeriod = fundingPeriod;
    if (contactPerson !== undefined) update.contactPerson = contactPerson;
    if (contactEmail !== undefined) update.contactEmail = contactEmail;
    if (transferred !== undefined) {
      update.transferred = transferred;
      if (transferred) update.transferredAt = new Date();
    }
    if (transferredToFundId !== undefined) update.transferredToFundId = transferredToFundId;
    if (receivedToOrg !== undefined) update.receivedToOrg = receivedToOrg;
    if (untransferredId !== undefined) update.untransferredId = untransferredId;

    const client = await clientPromise;
    const db = client.db('resources');
    const res = await db.collection('grant_applications').updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );

    if (!res.matchedCount) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ _id: id, ...update });
  } catch (e) {
    console.error('PUT /api/organization/grant-applications/[id] error', e);
    return NextResponse.json({ error: 'Failed to update grant application' }, { status: 500 });
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
    const res = await db.collection('grant_applications').deleteOne({ _id: new ObjectId(id) });

    if (!res.deletedCount) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('DELETE /api/organization/grant-applications/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete grant application' }, { status: 500 });
  }
}
