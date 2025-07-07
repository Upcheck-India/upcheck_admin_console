import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - Fetch projects
export async function GET(req) {
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

    const projectsCollection = db.collection('projects');
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab');

    let query = {};
    if (tab === 'my') {
      query = {
        $or: [
          { superManager: user.username },
          { 'members.user': user.username }
        ]
      };
    }

    const projects = await projectsCollection.find(query).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST - Create a new project
export async function POST(req) {
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

    // Restrict interns from creating projects
    if (user.role === 'Intern') {
      return NextResponse.json({ error: 'Forbidden: Interns cannot create projects' }, { status: 403 });
    }

    const { name, description, logo, members: newMembers = [] } = await req.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const projectsCollection = db.collection('projects');
    const existingProject = await projectsCollection.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });

    if (existingProject) {
      return NextResponse.json({ error: 'A project with this name already exists' }, { status: 409 });
    }

    // Combine the creator (as Super Manager) with the new members from the request
    const creatorMember = { user: user.username, email: user.email, role: 'Super Manager' };
    const otherMembers = newMembers.filter(m => m.user !== user.username);
    const finalMembers = [creatorMember, ...otherMembers];

    const newProject = {
      name: name.trim(),
      description: description?.trim() || '',
      logo: logo || '',
      superManager: user.username,
      members: finalMembers,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await projectsCollection.insertOne(newProject);
    const createdProject = { _id: result.insertedId, ...newProject };

    return NextResponse.json(createdProject, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
