import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireAuth, canManageUsers, logActivity } from '../../../../../lib/serverAuth';
import { buildProfilePatch, PROFILE_PROJECTION } from '../../../../../lib/hr/employee';

// Resolve the target employee id, allowing the alias "me" for the caller.
function resolveId(id, user) {
  if (id === 'me') return String(user._id);
  return id;
}

// GET - full HR profile for one employee. Self or `users.manage`.
export async function GET(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  const id = resolveId(params.id, user);
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid employee id' }, { status: 400 });
  }
  const isSelf = String(user._id) === id;
  if (!isSelf && !canManageUsers(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const employee = await db.collection('admin_users')
    .findOne({ _id: new ObjectId(id) }, { projection: PROFILE_PROJECTION });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  let manager = null;
  if (employee.managerId) {
    manager = await db.collection('admin_users')
      .findOne({ _id: employee.managerId }, { projection: { username: 1, firstName: 1, lastName: 1, email: 1 } });
  }

  return NextResponse.json({
    employee,
    manager,
    canManage: canManageUsers(user),
    isSelf,
  });
}

// PATCH - update personal and (for managers) statutory/financial fields.
export async function PATCH(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  const id = resolveId(params.id, user);
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid employee id' }, { status: 400 });
  }
  const isSelf = String(user._id) === id;
  const canManage = canManageUsers(user);
  if (!isSelf && !canManage) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const target = await db.collection('admin_users').findOne({ _id: new ObjectId(id) }, { projection: { username: 1 } });
  if (!target) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  // Statutory fields may be edited on your own record, or on anyone's record
  // by a manager. (A regular user cannot edit someone else's record at all.)
  const { set, errors } = buildProfilePatch(data, { includeStatutory: isSelf || canManage });
  if (errors.length) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  set.updatedAt = new Date();
  await db.collection('admin_users').updateOne({ _id: new ObjectId(id) }, { $set: set });

  await logActivity(db, {
    action: 'hr.profile.update',
    actor: user,
    targetType: 'user',
    targetId: id,
    targetName: target.username,
    metadata: { fields: Object.keys(set).filter((k) => k !== 'updatedAt') },
  });

  const employee = await db.collection('admin_users')
    .findOne({ _id: new ObjectId(id) }, { projection: PROFILE_PROJECTION });
  return NextResponse.json({ employee });
}
