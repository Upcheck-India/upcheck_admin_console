// src/app/api/share/[token]/delete/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { cookies } from 'next/headers';

/**
 * DELETE /api/share/[token]/delete
 * Delete a share link
 */
export async function DELETE(req, { params }) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get auth token
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token')?.value;

    if (!adminToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user
    const user = await db.collection('admin_users').findOne({ sessionToken: adminToken });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get share record
    const share = await db.collection('shared_resources').findOne({ token });
    if (!share) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    // Verify ownership
    if (share.createdBy.username !== user.username && user.role !== 'Admin' && user.role !== 'Console admin') {
      return NextResponse.json({ error: 'Not authorized to delete this share link' }, { status: 403 });
    }

    // Delete share record
    await db.collection('shared_resources').deleteOne({ token });

    return NextResponse.json({ success: true, message: 'Share link deleted' });

  } catch (error) {
    console.error('Share delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
