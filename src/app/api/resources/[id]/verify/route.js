// src/app/api/resources/[id]/verify/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export async function POST(req, { params }) {
  try {
    const { id } = params;
    const { password } = await req.json();
    
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid resource ID" }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find the resource
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });
    
    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }
    
    // Verify if the resource is password protected
    if (!resource.isPasswordProtected || !resource.passwordHash) {
      return NextResponse.json({ error: "Resource is not password protected" }, { status: 400 });
    }
    
    // Verify the password
    const isPasswordCorrect = await bcrypt.compare(password, resource.passwordHash);
    
    if (!isPasswordCorrect) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
    
    // Generate a temporary access token (in a real app, use JWT or similar)
    const accessToken = Date.now().toString();
    
    // Could store this token in a temporary access collection with expiration
    // For simplicity, we're just returning success here
    
    return NextResponse.json({ 
      success: true,
      message: "Password verified successfully",
      accessToken
    });
  } catch (error) {
    console.error('Password verification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
