// src/app/api/resources/[id]/verify-password/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

/**
 * POST /api/resources/[id]/verify-password
 * Verify password for a password-protected resource
 */
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

    // Get the resource
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Check if resource is password protected
    if (!resource.isPasswordProtected || !resource.passwordHash) {
      return NextResponse.json({
        success: true,
        message: "Resource is not password protected"
      });
    }

    // Verify password
    const isPasswordCorrect = await bcrypt.compare(password, resource.passwordHash);

    if (!isPasswordCorrect) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // Set a cookie to mark this resource as verified
    const cookieStore = cookies();
    const verifiedResources = JSON.parse(cookieStore.get('verified_resources')?.value || '{}');
    verifiedResources[id] = true;

    // Create response with success
    const response = NextResponse.json({
      success: true,
      message: "Password verified successfully"
    });

    // Set the verified_resources cookie
    response.cookies.set('verified_resources', JSON.stringify(verifiedResources), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Verify password error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
