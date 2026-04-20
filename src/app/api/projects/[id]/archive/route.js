// src/app/api/projects/[id]/archive/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

/**
 * PUT /api/projects/:id/archive
 * Archive a project (soft delete alternative)
 */
export async function PUT(req, { params }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

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

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only super manager or admin can archive
    const isSuperManager = project.superManager === user.username;
    const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
    if (!isSuperManager && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update status to archived
    await db.collection('projects').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'archived',
          archivedAt: new Date(),
          archivedBy: user.username,
          updatedAt: new Date(),
        },
      }
    );

    // Log activity
    await db.collection('doc_activity_logs').insertOne({
      projectId: id,
      action: 'project_archive',
      resourceType: 'project',
      resourceName: project.name,
      userId: user._id,
      username: user.username,
      timestamp: new Date(),
      metadata: {
        previousStatus: project.status,
        newStatus: 'archived',
      },
    });

    const archivedProject = await db.collection('projects').findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      success: true,
      message: 'Project archived successfully',
      project: archivedProject,
    });

  } catch (error) {
    console.error('Error archiving project:', error);
    return NextResponse.json({ error: 'Failed to archive project' }, { status: 500 });
  }
}
