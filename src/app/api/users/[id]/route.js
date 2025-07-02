// src/app/api/users/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

// GET user by ID
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
      { projection: { password: 0 } } // Exclude password from response
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const ROLES_HIERARCHY = {
  'Console admin': ['Admin', 'Member', 'Intern'],
  'Admin': ['Member', 'Intern'],
  'Member': [],
  'Intern': []
};

export async function PUT(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const data = await request.json();
    const userRole = request.headers.get('x-user-role');
    const userId = params.id;

    console.log('Update request -', { userRole, targetRole: data.role, userId });

    // Special handling for Console admin
    if (userRole === 'Console admin') {
      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      if (data.password) {
        updateData.password = crypto
          .createHash('sha256')
          .update(data.password)
          .digest('hex');
      }

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

      return NextResponse.json({ message: 'User updated successfully' });
    }

    // Regular role permission check for non-Console admins
    if (!ROLES_HIERARCHY[userRole]?.includes(data.role)) {
      return NextResponse.json(
        { error: 'Unauthorized to modify users with this role' },
        { status: 403 }
      );
    }

    // Rest of the update logic...
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update user: ' + error.message },
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

    const user = await db.collection('admin_users').findOne(
      { _id: new ObjectId(userId) }
    );
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Console admin can delete any user
    if (userRole === 'Console admin') {
      const result = await db.collection('admin_users').deleteOne(
        { _id: new ObjectId(userId) }
      );

      return NextResponse.json({ message: 'User deleted successfully' });
    }

    // Regular role permission check
    if (!ROLES_HIERARCHY[userRole]?.includes(user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this user' },
        { status: 403 }
      );
    }

    // Rest of delete logic...
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user: ' + error.message },
      { status: 500 }
    );
  }
}