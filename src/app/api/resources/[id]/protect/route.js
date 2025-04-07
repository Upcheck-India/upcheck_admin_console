// src/app/api/resources/[id]/protect/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(req, { params }) {
  try {
    const { id } = params;
    const { isLocked, password, oldPassword } = await req.json();
    
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid resource ID" }, { status: 400 });
    }

    // Get the admin token from cookies for authentication
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find the resource
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });
    
    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }
    
    // Handle password protection
    let updateData = {};

    // If we're removing password protection, verify the current password
    if (!isLocked) {
      // Check if the resource is currently password protected
      if (resource.isPasswordProtected && resource.passwordHash) {
        // Verify oldPassword is provided
        if (!oldPassword) {
          return NextResponse.json({ error: "Current password is required to remove protection" }, { status: 400 });
        }

        // Verify current password
        const isPasswordCorrect = await bcrypt.compare(oldPassword, resource.passwordHash);
        if (!isPasswordCorrect) {
          return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
        }

        // Password verified, remove protection
        updateData = {
          isPasswordProtected: false,
          passwordHash: null
        };
      } else {
        // Resource isn't password protected
        updateData = {
          isPasswordProtected: false,
          passwordHash: null
        };
      }
    }
    // If we're adding password protection
    else if (isLocked && password) {
      // Hash the password before storing it
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      updateData = {
        isPasswordProtected: true,
        passwordHash: hashedPassword
      };
    } else {
      return NextResponse.json({ error: "Password is required when protecting a resource" }, { status: 400 });
    }
    
    // Update the resource
    await db.collection('resources').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    return NextResponse.json({ 
      success: true,
      message: isLocked ? "Resource password protection added" : "Resource password protection removed",
      isPasswordProtected: isLocked
    });
  } catch (error) {
    console.error('Password protection error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
