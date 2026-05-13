import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { clerkClient } from '@clerk/nextjs/server';
import bcrypt from 'bcryptjs';

// External user roles - these have no permissions by default
const EXTERNAL_ROLES = [
  'Investor',
  'Advisor',
  'Legal',
  'Auditor',
  'Visitor',
  'external_viewer' // Legacy role
];

// GET /api/user-management/external-users - Get all external users with optional status filter
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending_approval, active, expired, etc.
    const role = searchParams.get('role');

    const client = await clientPromise;
    const db = client.db('resources');

    const query = {};
    if (status) query.status = status;
    if (role) query.role = role;

    const externalUsers = await db.collection('dataroom_external_users')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Check for expired temporary users and update their status
    const now = new Date();
    const expiredUsers = externalUsers.filter(u =>
      u.expiresAt && new Date(u.expiresAt) < now && u.status === 'active'
    );

    if (expiredUsers.length > 0) {
      // Update expired users in bulk
      const expiredIds = expiredUsers.map(u => u._id);
      await db.collection('dataroom_external_users').updateMany(
        { _id: { $in: expiredIds } },
        { $set: { status: 'expired', updatedAt: now } }
      );

      // Update the status in the returned data as well
      expiredUsers.forEach(u => u.status = 'expired');
    }

    return NextResponse.json({
      success: true,
      users: externalUsers,
      count: externalUsers.length,
      expiredCount: expiredUsers.length,
    });

  } catch (error) {
    console.error('GET /api/user-management/external-users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/user-management/external-users - Create, approve, or reject external user
export async function POST(request) {
  try {
    const body = await request.json();

    // Check if this is a create action (has email, name, etc.) or approve/reject action (has userId, action)
    const { userId, action } = body;

    if (userId && action) {
      // Approve/reject flow
      if (!['approve', 'reject'].includes(action)) {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }

      const client = await clientPromise;
      const db = client.db('resources');

      const user = await db.collection('dataroom_external_users').findOne({
        _id: new ObjectId(userId)
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (action === 'approve') {
        await db.collection('dataroom_external_users').updateOne(
          { _id: new ObjectId(userId) },
          {
            $set: {
              status: 'active',
              approvedAt: new Date(),
              updatedAt: new Date(),
            }
          }
        );

        return NextResponse.json({
          success: true,
          message: 'User approved successfully',
        });
      } else {
        await db.collection('dataroom_external_users').updateOne(
          { _id: new ObjectId(userId) },
          {
            $set: {
              status: 'rejected',
              rejectedAt: new Date(),
              updatedAt: new Date(),
            }
          }
        );

        return NextResponse.json({
          success: true,
          message: 'User rejected successfully',
        });
      }
    } else {
      // Create new external user flow (admin adding manually)
      const {
        email,
        name,
        mobileNumber,
        company,
        designation,
        role = 'Visitor',
        department = 'None',
        reason,
        expiresAt,
        addedBy,
        sendInviteEmail = true
      } = body;

      if (!email || !name) {
        return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
      }

      // Validate role
      if (!EXTERNAL_ROLES.includes(role)) {
        return NextResponse.json({
          error: `Invalid role. Must be one of: ${EXTERNAL_ROLES.join(', ')}`
        }, { status: 400 });
      }

      const emailLower = email.toLowerCase().trim();

      const client = await clientPromise;
      const db = client.db('resources');

      // Check if email already exists
      const existingUser = await db.collection('dataroom_external_users').findOne({ email: emailLower });
      if (existingUser) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      }

      // Generate a random temporary password
      const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Create the user
      const newUser = {
        email: emailLower,
        passwordHash,
        name: name.trim(),
        mobileNumber: mobileNumber?.trim() || null,
        company: company?.trim() || null,
        designation: designation?.trim() || null,
        role,
        department,
        reason: reason?.trim() || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null, // Temporary authorization
        addedBy: addedBy || 'Admin',
        addedAt: new Date(),
        status: 'active', // Directly active since admin added
        emailVerified: true, // Admin added users are considered verified
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        loginAttempts: 0,
        lockedUntil: null,
        sessionToken: null,
        sessionExpiry: null,
        isTemporary: expiresAt ? true : false,
      };

      const result = await db.collection('dataroom_external_users').insertOne(newUser);

      // Send invite email if requested
      if (sendInviteEmail) {
        try {
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.default.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          const expiryInfo = expiresAt
            ? `<p><strong>⚠️ Temporary Access:</strong> Your access will expire on ${new Date(expiresAt).toLocaleDateString()}. After this date, you will no longer be able to login.</p>`
            : '';

          const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: emailLower,
            subject: `You've been invited to Upcheck Data Room as ${role}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                  .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                  .credentials { background: white; border: 2px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 8px; }
                  .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Welcome to Upcheck!</h1>
                    <p>You've been invited as ${role}</p>
                  </div>
                  <div class="content">
                    <p>Hello ${name.trim()},</p>
                    <p><strong>${addedBy || 'An admin'}</strong> has invited you to access Upcheck Data Room as a <strong>${role}</strong>.</p>
                    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                    ${expiryInfo}
                    <div class="credentials">
                      <p><strong>Your login credentials:</strong></p>
                      <p>Email: ${emailLower}</p>
                      <p>Temporary Password: <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
                      <p style="font-size: 12px; color: #6b7280;">Please change your password after your first login.</p>
                    </div>
                    <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://upcheck.in'}/dataroom/external/login" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Login Now</a></p>
                    <p>If you have any questions, please contact the person who invited you.</p>
                    <p>Best regards,<br>Upcheck Team</p>
                  </div>
                  <div class="footer">
                    <p>This is an automated message, please do not reply to this email.</p>
                    <p>&copy; ${new Date().getFullYear()} Upcheck. All rights reserved.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
          };

          await transporter.sendMail(mailOptions);
        } catch (emailError) {
          console.error('Failed to send invite email:', emailError);
          // Don't fail creation if email fails
        }
      }

      return NextResponse.json({
        success: true,
        userId: result.insertedId,
        message: 'External user created successfully',
        tempPassword: sendInviteEmail ? undefined : tempPassword, // Only return password if not sent via email
      }, { status: 201 });
    }

  } catch (error) {
    console.error('POST /api/user-management/external-users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/user-management/external-users - Delete external user from both MongoDB and Clerk
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const clerkId = searchParams.get('clerkId');
    const deleteFromClerk = searchParams.get('deleteFromClerk') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Find the user in MongoDB
    const user = await db.collection('dataroom_external_users').findOne({
      _id: new ObjectId(userId)
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found in MongoDB' }, { status: 404 });
    }

    // Get Clerk ID from user record or from query param
    const userClerkId = clerkId || user.clerkId;

    // Delete from Clerk if requested and clerkId exists
    if (deleteFromClerk && userClerkId) {
      try {
        await clerkClient.users.deleteUser(userClerkId);
        console.log(`Deleted user ${userClerkId} from Clerk`);
      } catch (clerkError) {
        // User might not exist in Clerk anymore, log but continue with MongoDB deletion
        console.warn(`Could not delete from Clerk (user may not exist): ${userClerkId}`, clerkError);
      }
    }

    // Delete from MongoDB
    await db.collection('dataroom_external_users').deleteOne({
      _id: new ObjectId(userId)
    });

    console.log(`Deleted user ${userId} from MongoDB`);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      deletedFromClerk: deleteFromClerk && userClerkId,
    });

  } catch (error) {
    console.error('DELETE /api/user-management/external-users error:', error);
    return NextResponse.json({
      error: 'Internal Server Error',
      details: error.message
    }, { status: 500 });
  }
}

// PUT /api/user-management/external-users - Update external user
export async function PUT(request) {
  try {
    const body = await request.json();
    const { userId, role, expiresAt, status, reason, department } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const updateData = { updatedAt: new Date() };

    if (role && EXTERNAL_ROLES.includes(role)) {
      updateData.role = role;
    }

    if (expiresAt) {
      updateData.expiresAt = new Date(expiresAt);
      updateData.isTemporary = true;
    } else if (expiresAt === null) {
      updateData.expiresAt = null;
      updateData.isTemporary = false;
    }

    if (status) {
      updateData.status = status;
    }

    if (reason) {
      updateData.reason = reason;
    }

    if (department) {
      updateData.department = department;
    }

    const result = await db.collection('dataroom_external_users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
    });

  } catch (error) {
    console.error('PUT /api/user-management/external-users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
