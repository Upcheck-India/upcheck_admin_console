// src/app/api/share/list/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

/**
 * GET /api/share/list
 * List all share links for a user or project
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const resourceId = searchParams.get('resourceId');

    const client = await clientPromise;
    const db = client.db('resources');

    // Get auth token
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Build query
    const query = { active: true };

    // Admins can see all shares, others only their own
    if (user.role !== 'Admin' && user.role !== 'Console admin') {
      query['createdBy.username'] = user.username;
    }

    // Filter by project if provided
    if (projectId) {
      const resourceIds = await db.collection('resources')
        .find({ projectId })
        .project({ _id: 1 })
        .toArray();

      query.resourceId = {
        $in: resourceIds.map(r => r._id)
      };
    }

    // Filter by specific resource if provided
    if (resourceId) {
      query.resourceId = new ObjectId(resourceId);
    }

    // Fetch share links
    const shares = await db.collection('shared_resources')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Enrich with resource info and remove sensitive data
    const enrichedShares = await Promise.all(
      shares.map(async (share) => {
        const resource = await db.collection('resources').findOne({ _id: share.resourceId });

        return {
          ...share,
          _id: share._id.toString(),
          resource: resource ? {
            _id: resource._id.toString(),
            name: resource.name,
            projectId: resource.projectId,
            folderId: resource.folderId,
          } : null,
          // Remove sensitive data
          passwordHash: undefined,
        };
      })
    );

    return NextResponse.json(enrichedShares);

  } catch (error) {
    console.error('Share list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
