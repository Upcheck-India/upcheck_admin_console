// src/app/api/users/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";
import { roleHierarchy, canManageUser } from '../../../utils/userManagement';
import { ObjectId } from 'mongodb';

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const currentUserRole = req.headers.get('x-user-role');

    if (!currentUserRole || !roleHierarchy[currentUserRole]) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Determine which users can be viewed based on role hierarchy
    const query = {};
    if (currentUserRole !== 'Console admin') {
      // Users can only view users of lower-level roles
      query.role = { 
        $in: roleHierarchy[currentUserRole].canManage 
      };
    }

    const users = await db.collection('admin_users')
      .find(query, { projection: { password: 0 } })
      .toArray();

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const body = await req.json();
    const currentUserRole = req.headers.get('x-user-role');
    
    // Validate role permissions
    if (!currentUserRole || 
        !roleHierarchy[currentUserRole] || 
        !roleHierarchy[currentUserRole].canManage.includes(body.role)) {
      return NextResponse.json(
        { error: "Unauthorized to create user with this role" },
        { status: 403 }
      );
    }

    // Validate department management permission
    if (body.department && body.department !== 'Unassigned' && 
        !roleHierarchy[currentUserRole].perms.includes('department.manage') &&
        !roleHierarchy[currentUserRole].perms.includes('department.assign')) {
      return NextResponse.json(
        { error: "Unauthorized to assign department" },
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

    const newUser = {
      username: body.username,
      email: body.email,
      password: body.password, // Ensure this is already hashed on the client
      role: body.role,
      department: body.department || 'Unassigned',
      perms: currentUserRole === 'Console admin' ? body.perms : roleHierarchy[body.role].perms,
      lastLogin: new Date()
    };

    const result = await db.collection('admin_users').insertOne(newUser);
    return NextResponse.json({ 
      success: true, 
      _id: result.insertedId.toString() 
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}