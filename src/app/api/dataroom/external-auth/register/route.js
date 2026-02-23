import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

// POST /api/dataroom/external-auth/register - Register external user for data room access
export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      email, 
      password, 
      name, 
      mobileNumber, 
      altEmail, 
      purpose, 
      invitedBy, 
      company,
      designation,
      address
    } = body;

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 });
    }

    // Email validation
    const emailLower = email.toLowerCase().trim();
    
    // Block @upcheck.* emails for external users
    if (emailLower.includes('@upcheck.')) {
      return NextResponse.json({ 
        error: 'Upcheck staff emails are not allowed for external user registration. Please use "Login as Upcheck Staff" instead.' 
      }, { status: 400 });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return NextResponse.json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
      }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Check if email already exists in external users
    const existingUser = await db.collection('dataroom_external_users').findOne({ email: emailLower });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered. Please login instead.' }, { status: 409 });
    }

    // Also check admin_users to prevent duplicate with staff
    const existingAdmin = await db.collection('admin_users').findOne({ email: emailLower });
    if (existingAdmin) {
      return NextResponse.json({ 
        error: 'This email is registered as Upcheck Staff. Please use "Login as Upcheck Staff" instead.' 
      }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create external user
    const newUser = {
      email: emailLower,
      passwordHash,
      name: name.trim(),
      mobileNumber: mobileNumber?.trim() || null,
      altEmail: altEmail?.trim() || null,
      purpose: purpose?.trim() || null,
      invitedBy: invitedBy?.trim() || null,
      company: company?.trim() || null,
      designation: designation?.trim() || null,
      address: address?.trim() || null,
      role: 'external_viewer', // Default role
      status: 'active',
      emailVerified: false,
      sessionToken: null,
      sessionExpiry: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      loginAttempts: 0,
      lockedUntil: null,
    };

    const result = await db.collection('dataroom_external_users').insertOne(newUser);

    // Return success without sensitive data
    return NextResponse.json({
      success: true,
      userId: result.insertedId,
      email: emailLower,
      name: name.trim(),
      message: 'Registration successful. You can now login to access the data room.',
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/external-auth/register error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
