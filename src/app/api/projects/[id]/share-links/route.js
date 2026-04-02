import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET  /api/projects/:id/share-links
 *      Returns all share links for the project (only authorized users)
 * POST /api/projects/:id/share-links
 *      Creates a new share link (only Super Manager or Project Manager)
 *      Body: {
 *        name: string,
 *        expiresAt?: string (ISO date),
 *        settings: {
 *          showSprints: string[] (sprint IDs to show),
 *          showUserNames: boolean,
 *          showDescriptions: boolean,
 *          showDueDates: boolean
 *        }
 *      }
 */

async function authAndGetDb(request) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const client = await clientPromise;
  const db = client.db('resources');
  const user = await db.collection('admin_users').findOne({ sessionToken: token });
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { db, user };
}

function isProjectManager(user, project) {
  return project.superManager === user.username ||
         project.members.some(m => m.user === user.username && m.role === 'Project Manager');
}

export async function GET(request, { params }) {
  try {
    const { db, user, error } = await authAndGetDb(request);
    if (error) return error;

    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectId = new ObjectId(params.id);
    const project = await db.collection('projects').findOne({ _id: projectId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is a member
    const isMember = project.superManager === user.username ||
                     project.members.some(m => m.user === user.username);
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const shareLinks = await db.collection('project_share_links')
      .find({ projectId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(shareLinks);
  } catch (err) {
    console.error('Failed to fetch share links:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { db, user, error } = await authAndGetDb(request);
    if (error) return error;

    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectId = new ObjectId(params.id);
    const project = await db.collection('projects').findOne({ _id: projectId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only Super Manager or Project Manager can create share links
    if (!isProjectManager(user, project)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, expiresAt, settings } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Share link name is required' }, { status: 400 });
    }

    // Generate a unique slug for the share link
    const slug = generateUniqueSlug();

    const newShareLink = {
      projectId,
      name: name.trim(),
      slug,
      settings: {
        showSprints: settings?.showSprints || [],
        showUserNames: settings?.showUserNames !== false, // default true
        showDescriptions: settings?.showDescriptions !== false, // default true
        showDueDates: settings?.showDueDates !== false, // default true
      },
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
      createdBy: user.username,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertRes = await db.collection('project_share_links').insertOne(newShareLink);
    newShareLink._id = insertRes.insertedId;

    return NextResponse.json(newShareLink, { status: 201 });
  } catch (err) {
    console.error('Failed to create share link:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function generateUniqueSlug() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 12; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}
