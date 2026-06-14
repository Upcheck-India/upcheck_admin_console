// src/app/api/users/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

// Role hierarchy for permission checks
const ROLES_HIERARCHY = {
  'Console admin': ['Admin', 'Member', 'Intern'],
  'Admin': ['Member', 'Intern'],
  'Member': [],
  'Intern': []
};

// Employment types
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contractor', 'intern'];

// Employment statuses
const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'suspended', 'terminated'];

// Password validation helper
function validatePassword(password) {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (password && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (password && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (password && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return { valid: errors.length === 0, errors };
}

// Helper function to check role permissions
const canModifyRole = (currentUserRole, targetRole) => {
  if (currentUserRole === 'Console admin') return true;
  return ROLES_HIERARCHY[currentUserRole]?.includes(targetRole);
};

// Log user activity
async function logUserActivity(db, action, targetUserId, targetUsername, actorId, actorUsername, metadata = {}) {
  try {
    await db.collection('user_activity_logs').insertOne({
      action,
      targetType: 'user',
      targetId: targetUserId,
      targetUsername,
      actorId,
      actorUsername,
      timestamp: new Date(),
      metadata
    });
  } catch (error) {
    console.error('Failed to log user activity:', error);
  }
}

// GET - Fetch user by ID
export async function GET(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const userId = params.id;

    // Validate ObjectId
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const user = await db.collection('admin_users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get manager info if assigned
    if (user.managerId) {
      const manager = await db.collection('admin_users')
        .findOne({ _id: user.managerId }, { projection: { username: 1, email: 1, role: 1, firstName: 1, lastName: 1 } });
      user.manager = manager;
    }

    // Get teams this user belongs to
    const teams = await db.collection('teams')
      .find({
        $or: [
          { members: new ObjectId(userId) },
          { lead: new ObjectId(userId) }
        ]
      })
      .project({ name: 1, description: 1, lead: 1 })
      .toArray();

    user.teams = teams.map(t => ({
      _id: t._id,
      name: t.name,
      description: t.description,
      isLead: t.lead?.toString() === userId
    }));

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update user by ID
export async function PUT(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const data = await request.json();
    const userRole = request.headers.get('x-user-role');
    const actorId = request.headers.get('x-user-id');
    const userId = params.id;

    // Validate ObjectId
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Get existing user
    const existingUser = await db.collection('admin_users').findOne(
      { _id: new ObjectId(userId) }
    );

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Permission check
    if (userRole !== 'Console admin') {
      if (!ROLES_HIERARCHY[userRole]?.includes(existingUser.role)) {
        return NextResponse.json(
          { error: 'Unauthorized to modify this user' },
          { status: 403 }
        );
      }
      // Check if trying to upgrade to a role above allowed hierarchy
      if (data.role && !ROLES_HIERARCHY[userRole]?.includes(data.role)) {
        return NextResponse.json(
          { error: 'Unauthorized to assign this role' },
          { status: 403 }
        );
      }
    }

    // Build update object
    const updateData = {
      updatedAt: new Date(),
      updatedBy: actorId ? new ObjectId(actorId) : null
    };

    // Core fields
    if (data.username !== undefined && data.username !== existingUser.username) {
      const trimmedUsername = data.username.trim().toLowerCase();
      // Check if new username exists
      const existingUsername = await db.collection('admin_users').findOne({
        username: trimmedUsername,
        _id: { $ne: new ObjectId(userId) }
      });
      if (existingUsername) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
      }
      updateData.username = trimmedUsername;
    }

    if (data.email !== undefined) {
      const trimmedEmail = data.email.trim().toLowerCase();
      if (trimmedEmail !== existingUser.email) {
        const existingEmail = await db.collection('admin_users').findOne({
          email: trimmedEmail,
          _id: { $ne: new ObjectId(userId) }
        });
        if (existingEmail) {
          return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
        }
      }
      updateData.email = trimmedEmail;
    }

    if (data.role !== undefined) {
      updateData.role = data.role;
    }

    if (data.department !== undefined) {
      updateData.department = data.department;
    }

    if (data.perms !== undefined) {
      updateData.perms = data.perms;
    }

    // HR fields
    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName.trim();
    }

    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName.trim();
    }

    if (data.jobTitle !== undefined) {
      updateData.jobTitle = data.jobTitle.trim();
    }

    if (data.employmentType !== undefined) {
      if (EMPLOYMENT_TYPES.includes(data.employmentType)) {
        updateData.employmentType = data.employmentType;
      }
    }

    if (data.employmentStatus !== undefined) {
      if (EMPLOYMENT_STATUSES.includes(data.employmentStatus)) {
        updateData.employmentStatus = data.employmentStatus;
        // If terminated, set end date
        if (data.employmentStatus === 'terminated' && !existingUser.endDate) {
          updateData.endDate = new Date();
        }

        // Sync status back to people_records if linked
        const peopleRecordId = existingUser.peopleRecordId;
        if (peopleRecordId) {
          let peopleStatus = 'active';
          if (data.employmentStatus === 'suspended') {
            peopleStatus = 'suspended';
          } else if (data.employmentStatus === 'terminated') {
            peopleStatus = 'alumni';
          }

          try {
            const peopleSet = { status: peopleStatus, updatedAt: new Date() };
            if (data.employmentStatus === 'terminated') {
              peopleSet.exitDate = new Date();
              peopleSet.exitType = 'terminated';
            } else if (data.employmentStatus === 'active') {
              peopleSet.exitDate = null;
              peopleSet.exitType = null;
            }

            await db.collection('people_records').updateOne(
              { _id: new ObjectId(peopleRecordId) },
              { $set: peopleSet }
            );
            console.log(`Synced user employmentStatus change to people record: ${peopleRecordId} -> ${peopleStatus}`);
          } catch (syncErr) {
            console.error(`Failed to sync status to people record ${peopleRecordId}:`, syncErr);
          }
        }
      }
    }

    if (data.managerId !== undefined) {
      if (data.managerId) {
        if (!ObjectId.isValid(data.managerId)) {
          return NextResponse.json({ error: 'Invalid manager ID' }, { status: 400 });
        }
        // Verify manager exists and is not the same user
        if (data.managerId === userId) {
          return NextResponse.json({ error: 'User cannot be their own manager' }, { status: 400 });
        }
        const manager = await db.collection('admin_users').findOne({ _id: new ObjectId(data.managerId) });
        if (!manager) {
          return NextResponse.json({ error: 'Manager not found' }, { status: 400 });
        }
        updateData.managerId = new ObjectId(data.managerId);
      } else {
        updateData.managerId = null;
      }
    }

    if (data.startDate !== undefined) {
      updateData.startDate = new Date(data.startDate);
    }

    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    }

    // Profile fields
    if (data.phone !== undefined) {
      updateData.phone = data.phone.trim();
    }

    if (data.location !== undefined) {
      updateData.location = data.location.trim();
    }

    if (data.timezone !== undefined) {
      updateData.timezone = data.timezone;
    }

    if (data.bio !== undefined) {
      updateData.bio = data.bio.trim();
    }

    if (data.avatar !== undefined) {
      updateData.avatar = data.avatar;
    }

    // Password change (requires separate validation)
    if (data.password) {
      const passwordValidation = validatePassword(data.password);
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: 'Password validation failed', details: passwordValidation.errors },
          { status: 400 }
        );
      }
      updateData.password = await bcrypt.hash(data.password, 12);
      updateData.lastPasswordChange = new Date();
    }

    // Perform update
    const result = await db.collection('admin_users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Log activity
    const actor = await db.collection('admin_users').findOne(
      { _id: actorId ? new ObjectId(actorId) : null },
      { projection: { username: 1 } }
    );
    await logUserActivity(
      db,
      'user_updated',
      userId,
      existingUser.username,
      actorId,
      actor?.username || 'system',
      {
        changes: Object.keys(updateData).filter(k => k !== 'updatedAt' && k !== 'updatedBy'),
        previousRole: existingUser.role,
        newRole: data.role || existingUser.role
      }
    );

    // Fetch updated user
    const updatedUser = await db.collection('admin_users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    return NextResponse.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update user: ' + error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete user by ID (soft delete preferred)
export async function DELETE(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const userRole = request.headers.get('x-user-role');
    const actorId = request.headers.get('x-user-id');
    const userId = params.id;

    // Validate ObjectId
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (userId === actorId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    const user = await db.collection('admin_users').findOne(
      { _id: new ObjectId(userId) }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Permission check - Console admin can delete any user, others follow hierarchy
    if (userRole !== 'Console admin') {
      if (!ROLES_HIERARCHY[userRole]?.includes(user.role)) {
        return NextResponse.json(
          { error: 'Unauthorized to delete this user' },
          { status: 403 }
        );
      }
    }

    // Check if user is a team lead
    const teamsAsLead = await db.collection('teams').find({
      lead: new ObjectId(userId)
    }).toArray();

    if (teamsAsLead.length > 0) {
      return NextResponse.json(
        { error: `User is a team lead for ${teamsAsLead.length} team(s). Assign a new lead before deleting.` },
        { status: 400 }
      );
    }

    // Remove user from all team memberships
    await db.collection('teams').updateMany(
      { members: new ObjectId(userId) },
      {
        $pull: { members: new ObjectId(userId) },
        $set: { updatedAt: new Date() }
      }
    );

    // Perform hard delete
    const result = await db.collection('admin_users').deleteOne(
      { _id: new ObjectId(userId) }
    );

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      );
    }

    // Log activity
    const actor = await db.collection('admin_users').findOne(
      { _id: actorId ? new ObjectId(actorId) : null },
      { projection: { username: 1 } }
    );
    await logUserActivity(
      db,
      'user_deleted',
      userId,
      user.username,
      actorId,
      actor?.username || 'system',
      {
        deletedUsername: user.username,
        deletedEmail: user.email,
        deletedRole: user.role,
        deletedDepartment: user.department
      }
    );

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user: ' + error.message },
      { status: 500 }
    );
  }
}