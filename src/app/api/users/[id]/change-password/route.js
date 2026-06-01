// src/app/api/users/[id]/change-password/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { sendTemplatedEmail, EMAIL_TYPES } from '../../../../../lib/emailService.js';

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

// POST - Change user password
export async function POST(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const userId = params.id;
    const actorId = request.headers.get('x-user-id');
    const actorRole = request.headers.get('x-user-role');

    // Validate ObjectId
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const data = await request.json();
    const { currentPassword, newPassword, confirmPassword } = data;

    // Validate required fields
    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'New password and confirmation do not match' },
        { status: 400 }
      );
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password validation failed', details: passwordValidation.errors },
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

    // Permission checks
    const isSelfChange = userId === actorId;
    const isAdmin = actorRole === 'Admin' || actorRole === 'Console admin';

    // Only allow self password change or admin change
    if (!isSelfChange && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized to change this user\'s password' },
        { status: 403 }
      );
    }

    // If user is changing their own password, verify current password
    if (isSelfChange) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required when changing your own password' },
          { status: 400 }
        );
      }

      // Verify current password
      // Handle both bcrypt and legacy SHA-256 hashed passwords
      let isValidPassword = false;

      if (existingUser.password.startsWith('$2')) {
        // bcrypt hash
        isValidPassword = await bcrypt.compare(currentPassword, existingUser.password);
      } else {
        // Legacy SHA-256 hash (for backward compatibility)
        const crypto = await import('crypto');
        const sha256Hash = crypto.createHash('sha256').update(currentPassword).digest('hex');
        isValidPassword = sha256Hash === existingUser.password;
      }

      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 401 }
        );
      }
    }

    // Hash new password with bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    const result = await db.collection('admin_users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          password: hashedPassword,
          lastPasswordChange: new Date(),
          updatedAt: new Date(),
          updatedBy: actorId ? new ObjectId(actorId) : null
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Log password change activity
    try {
      const actor = await db.collection('admin_users').findOne(
        { _id: actorId ? new ObjectId(actorId) : null },
        { projection: { username: 1, firstName: 1, lastName: 1 } }
      );

      await db.collection('user_activity_logs').insertOne({
        action: isSelfChange ? 'password_changed_self' : 'password_changed_by_admin',
        targetType: 'user',
        targetId: userId,
        targetUsername: existingUser.username,
        actorId,
        actorUsername: actor?.username || 'system',
        timestamp: new Date(),
        metadata: {
          changedByAdmin: !isSelfChange
        }
      });
    } catch (logError) {
      console.error('Failed to log password change:', logError);
    }

    // Send password change notification email
    try {
      if (existingUser.email) {
        const actorInfo = await db.collection('admin_users').findOne(
          { _id: actorId ? new ObjectId(actorId) : null },
          { projection: { username: 1, firstName: 1, lastName: 1 } }
        );
        const changedBy = actorInfo?.firstName || actorInfo?.lastName
          ? `${actorInfo.firstName} ${actorInfo.lastName}`.trim()
          : actorInfo?.username || 'System';

        await sendTemplatedEmail(EMAIL_TYPES.PASSWORD_CHANGE, {
          name: existingUser.firstName || existingUser.lastName
            ? `${existingUser.firstName} ${existingUser.lastName}`.trim()
            : existingUser.username,
          username: existingUser.username,
          timestamp: new Date(),
          changedBy: isSelfChange ? 'You' : changedBy
        }, {
          to: existingUser.email
        });
        console.log(`Password change notification sent to ${existingUser.email}`);
      }
    } catch (emailError) {
      console.error('Failed to send password change notification:', emailError.message);
      // Don't fail password change if email fails
    }

    return NextResponse.json({
      message: 'Password changed successfully',
      newPasswordHashed: true
    });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: 'Failed to change password: ' + error.message },
      { status: 500 }
    );
  }
}