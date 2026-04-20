import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

// POST - Verify password for protected resource
export async function POST(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { password } = await req.json();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid resource ID' }, { status: 400 });
    }

    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    if (!resource.isPasswordProtected) {
      return NextResponse.json({ success: true });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, resource.password);
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error verifying password:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
