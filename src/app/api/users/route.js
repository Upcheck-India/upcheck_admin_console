// src/app/api/users/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import crypto from 'crypto';

const ROLES_HIERARCHY = {
  'Console admin': ['Admin', 'Member', 'Intern'],
  'Admin': ['Member', 'Intern'],
  'Member': [],
  'Intern': []
};

// Helper function to check role permissions
const canModifyRole = (currentUserRole, targetRole) => {
  if (currentUserRole === 'Console admin') return true;
  return ROLES_HIERARCHY[currentUserRole]?.includes(targetRole);
};

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const currentUserRole = req.headers.get('x-user-role');

    console.log('GET /api/users - Current user role:', currentUserRole);

    // All authenticated users (except interns) can see all users
    // No need for role-based query filtering
    const users = await db.collection('admin_users')
      .find({})  // Get all users
      .project({ password: 0 })
      .toArray();

    console.log('Found users count:', users.length);

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const data = await request.json();
    const userRole = request.headers.get('x-user-role');

    // Validate permissions
    if (!ROLES_HIERARCHY[userRole]?.includes(data.role)) {
      return NextResponse.json(
        { error: 'Unauthorized to create users with this role' },
        { status: 403 }
      );
    }

    // Hash password using crypto (SHA-256)
    const hashedPassword = crypto
      .createHash('sha256')
      .update(data.password)
      .digest('hex');

    const newUser = {
      ...data,
      password: hashedPassword,
      createdAt: new Date(),
      lastLogin: new Date()
    };

    await db.collection('admin_users').insertOne(newUser);

    return NextResponse.json({ message: 'User created successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const data = await request.json();
    const userRole = request.headers.get('x-user-role');
    const userId = params.id;

    // Validate permissions - Allow Console admin to modify any user
    if (!canModifyRole(userRole, data.role)) {
      return NextResponse.json(
        { error: 'Unauthorized to modify users with this role' },
        { status: 403 }
      );
    }

    // If password is provided, hash it using crypto
    if (data.password) {
      data.password = crypto
        .createHash('sha256')
        .update(data.password)
        .digest('hex');
    } else {
      // Remove password field if not provided
      delete data.password;
    }

    const updateData = {
      ...data,
      updatedAt: new Date()
    };

    const result = await db.collection('admin_users').updateOne(
      { _id: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const userRole = request.headers.get('x-user-role');
    const userId = params.id;

    const user = await db.collection('admin_users').findOne({ _id: userId });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Validate permissions - Allow Console admin to delete any user
    if (!canModifyRole(userRole, user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this user' },
        { status: 403 }
      );
    }

    const result = await db.collection('admin_users').deleteOne({ _id: userId });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}