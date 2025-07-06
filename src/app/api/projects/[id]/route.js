import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// DELETE - Deletes a project by ID
export async function DELETE(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectsCollection = db.collection('projects');
    const project = await projectsCollection.findOne({ _id: new ObjectId(id) });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Security check: Only the superManager or a Project Manager can delete the project.
    const isSuperManager = project.superManager === user.username;
    const isProjectManager = project.members?.some(member => member.user === user.username && member.role === 'Project Manager');

    if (!isSuperManager && !isProjectManager) {
      return NextResponse.json({ error: 'Access denied: Only the Super Manager or a Project Manager can delete this project.' }, { status: 403 });
    }

    await projectsCollection.deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ message: 'Project deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting project ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

// GET - Fetch a single project by ID
export async function GET(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // If superManager is null, no one is the manager yet.
    const isSuperManager = project.superManager === user.username;
    // Check if the user is in the members array by username.
    const isMember = project.members.some(member => member.user === user.username);

    if (!isMember && !isSuperManager) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error(`Error fetching project ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}
