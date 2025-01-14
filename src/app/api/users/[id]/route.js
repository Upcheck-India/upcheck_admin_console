// src/app/api/users/[id]/route.js
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../lib/mongodb';
import { roleHierarchy, canManageUser } from '../../../../utils/userManagement';

export async function PUT(req, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const body = await req.json();
    const currentUserRole = req.headers.get('x-user-role');

    // Get the target user
    const targetUser = await db.collection('admin_users').findOne({
      _id: new ObjectId(params.id)
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if current user can manage target user
    if (!canManageUser(
      { role: currentUserRole },
      { role: targetUser.role }
    )) {
      return NextResponse.json(
        { error: "Unauthorized to modify this user" },
        { status: 403 }
      );
    }

    // Validate department change permission
    if (body.department !== targetUser.department &&
        !roleHierarchy[currentUserRole].perms.includes('department.manage') &&
        !roleHierarchy[currentUserRole].perms.includes('department.assign')) {
      return NextResponse.json(
        { error: "Unauthorized to modify department" },
        { status: 403 }
      );
    }

    // Validate email format if provided
    if (body.email && !body.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const updateData = {
      ...body,
      perms: currentUserRole === 'Console admin' 
        ? body.perms 
        : roleHierarchy[body.role].perms
    };

    // Remove password field if it's empty (for updates)
    if (!updateData.password) {
      delete updateData.password;
    }

    await db.collection('admin_users').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const currentUserRole = req.headers.get('x-user-role');

    const targetUser = await db.collection('admin_users').findOne({
      _id: new ObjectId(params.id)
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if current user can manage target user
    if (!canManageUser(
      { role: currentUserRole },
      { role: targetUser.role }
    )) {
      return NextResponse.json(
        { error: "Unauthorized to delete this user" },
        { status: 403 }
      );
    }

    await db.collection('admin_users').deleteOne({
      _id: new ObjectId(params.id)
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}