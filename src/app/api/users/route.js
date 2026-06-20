// src/app/api/users/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { sendTemplatedEmail, EMAIL_TYPES } from '../../../lib/emailService.js';

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

// Departments
const DEPARTMENTS = [
  'Development', 'Testing', 'QA', 'Design', 'Product',
  'Sales', 'Content', 'Marketing', 'Operations', 'HR', 'Finance', 'Unassigned'
];

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

// GET - Fetch all users (with pagination and filtering)
export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const currentUserRole = req.headers.get('x-user-role');

    // Get query parameters for pagination and filtering
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const department = searchParams.get('department');
    const role = searchParams.get('role');
    const employmentStatus = searchParams.get('employmentStatus');
    const search = searchParams.get('search');

    // Build query filter
    const query = {};

    if (department && department !== 'all') {
      query.department = department;
    }

    if (role && role !== 'all') {
      query.role = role;
    }

    if (employmentStatus && employmentStatus !== 'all') {
      query.employmentStatus = employmentStatus;
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { jobTitle: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Fetch users with pagination
    const users = await db.collection('admin_users')
      .find(query)
      .project({ password: 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count for pagination info
    const totalCount = await db.collection('admin_users').countDocuments(query);

    // For each user, get manager info if assigned
    const usersWithManager = await Promise.all(users.map(async (user) => {
      if (user.managerId) {
        const manager = await db.collection('admin_users')
          .findOne({ _id: user.managerId }, { projection: { username: 1, email: 1, role: 1 } });
        return { ...user, manager };
      }
      return user;
    }));

    return NextResponse.json({
      users: usersWithManager,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + limit < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users: ' + error.message },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const data = await request.json();
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    // Validate permissions
    if (!ROLES_HIERARCHY[userRole]?.includes(data.role)) {
      return NextResponse.json(
        { error: 'Unauthorized to create users with this role' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!data.username || !data.username.trim()) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    if (!data.password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password validation failed', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Check if username already exists (case-insensitive check)
    const escapedUsername = data.username.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const usernameRegex = new RegExp("^" + escapedUsername + "$", "i");
    const existingUser = await db.collection('admin_users').findOne({
      username: { $regex: usernameRegex }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    // Check if email already exists (if provided)
    if (data.email) {
      const existingEmail = await db.collection('admin_users').findOne({
        email: data.email.trim().toLowerCase()
      });

      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }
    }

    // Validate managerId if provided
    if (data.managerId) {
      if (!ObjectId.isValid(data.managerId)) {
        return NextResponse.json(
          { error: 'Invalid manager ID' },
          { status: 400 }
        );
      }
      const managerExists = await db.collection('admin_users').findOne({
        _id: new ObjectId(data.managerId)
      });
      if (!managerExists) {
        return NextResponse.json(
          { error: 'Manager not found' },
          { status: 400 }
        );
      }
    }

    // Hash password with bcrypt (12 rounds)
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Build new user object with HR fields
    const newUser = {
      // Core fields
      username: data.username.trim(),
      email: data.email?.trim().toLowerCase() || '',
      password: hashedPassword,
      role: data.role,
      department: data.department || 'Unassigned',
      perms: data.perms || [],

      // HR fields
      firstName: data.firstName?.trim() || '',
      lastName: data.lastName?.trim() || '',
      jobTitle: data.jobTitle?.trim() || '',
      employmentType: EMPLOYMENT_TYPES.includes(data.employmentType) ? data.employmentType : 'full_time',
      employmentStatus: EMPLOYMENT_STATUSES.includes(data.employmentStatus) ? data.employmentStatus : 'active',
      managerId: data.managerId ? new ObjectId(data.managerId) : null,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,

      // Profile fields
      phone: data.phone?.trim() || '',
      location: data.location?.trim() || '',
      timezone: data.timezone || 'UTC',
      bio: data.bio?.trim() || '',
      avatar: data.avatar || '',

      // Security/tracking fields
      emailVerified: false,
      twoFactorEnabled: false,
      loginCount: 0,
      lastLogin: null,
      lastIpAddress: null,
      lastPasswordChange: new Date(),

      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId ? new ObjectId(userId) : null
    };

    const result = await db.collection('admin_users').insertOne(newUser);

    // Log activity
    const actor = await db.collection('admin_users').findOne(
      { _id: userId ? new ObjectId(userId) : null },
      { projection: { username: 1 } }
    );
    await logUserActivity(
      db,
      'user_created',
      result.insertedId.toString(),
      newUser.username,
      userId,
      actor?.username || 'system',
      { role: newUser.role, department: newUser.department, employmentType: newUser.employmentType }
    );

    // Automatically create a corresponding record in people_records for HR tracking
    let peopleRecordId = null;
    try {
      const isIntern = newUser.role === 'Intern' || newUser.employmentType === 'intern';
      const type = isIntern ? 'intern' : 'employee';
      
      const counterKey = type === 'intern' ? 'utint_counter' : 'utemp_counter';
      const counter = await db.collection('counters').findOneAndUpdate(
        { _id: counterKey },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
      const num = String(counter.seq).padStart(5, '0');
      const employeeId = type === 'intern' ? `UTINT-${num}` : `UTEMP-${num}`;

      const personRecord = {
        employeeId,
        type,
        status: 'active',
        firstName: newUser.firstName || '',
        lastName: newUser.lastName || '',
        email: newUser.email || '',
        personalEmail: null,
        phone: newUser.phone || null,
        alternatePhone: null,
        department: newUser.department || null,
        jobTitle: newUser.jobTitle || null,
        managerId: newUser.managerId,
        joinDate: newUser.startDate || new Date(),
        exitDate: null,
        exitType: null,
        exitReason: null,
        reHireEligible: true,
        reHireNotes: null,
        systemUserId: result.insertedId,
        timeline: [
          {
            date: new Date(),
            event: 'system_user_created',
            description: `Linked system account '${newUser.username}' created.`,
            by: actor?.username || 'system',
          },
        ],
        notes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId ? new ObjectId(userId) : null
      };

      const peopleResult = await db.collection('people_records').insertOne(personRecord);
      peopleRecordId = peopleResult.insertedId;

      await db.collection('admin_users').updateOne(
        { _id: result.insertedId },
        { $set: { peopleRecordId } }
      );
      newUser.peopleRecordId = peopleRecordId;
      console.log(`Automatically created and linked people record ${peopleRecordId} for user ${result.insertedId}`);
    } catch (peopleErr) {
      console.error('Failed to automatically create linked people record:', peopleErr);
    }

    // Send welcome email to new user
    if (newUser.email && data.sendWelcomeEmail !== false) {
      try {
        await sendTemplatedEmail(EMAIL_TYPES.WELCOME_USER, {
          name: newUser.firstName || newUser.lastName ? `${newUser.firstName} ${newUser.lastName}`.trim() : newUser.username,
          username: newUser.username,
          email: newUser.email,
          password: data.password, // Only include password if user should see it
          role: newUser.role,
          department: newUser.department
        }, {
          to: newUser.email,
          type: EMAIL_TYPES.WELCOME_USER
        });
        console.log(`Welcome email sent to ${newUser.email}`);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError.message);
        // Don't fail user creation if email fails
      }
    }

    // Return user without password
    const { password, ...userWithoutPassword } = newUser;
    return NextResponse.json({
      message: 'User created successfully',
      user: { ...userWithoutPassword, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user: ' + error.message },
      { status: 500 }
    );
  }
}