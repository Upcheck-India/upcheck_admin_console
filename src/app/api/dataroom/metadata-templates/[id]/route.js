import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../../lib/dataroom/audit-logger';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user;
  } catch {
    return null;
  }
}

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

// GET /api/dataroom/metadata-templates/[id] - Get single template
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const template = await db.collection('dataroom_metadata_templates').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('GET /api/dataroom/metadata-templates/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/dataroom/metadata-templates/[id] - Update template
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, fields, isDefault } = body;

    const client = await clientPromise;
    const db = client.db('resources');

    const template = await db.collection('dataroom_metadata_templates').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const updates = { updatedAt: new Date() };

    if (name !== undefined) {
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description.trim();
    }

    if (fields !== undefined) {
      if (!Array.isArray(fields)) {
        return NextResponse.json({ error: 'fields must be an array' }, { status: 400 });
      }
      updates.fields = fields.map(f => ({
        name: f.name.trim(),
        type: f.type,
        label: f.label || f.name.trim(),
        placeholder: f.placeholder || '',
        required: f.required || false,
        validation: f.validation || null,
        options: f.options || [],
        defaultValue: f.defaultValue || null,
        helpText: f.helpText || '',
      }));
    }

    if (isDefault !== undefined) {
      updates.isDefault = isDefault;
    }

    await db.collection('dataroom_metadata_templates').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    await logAudit({
      action: 'TEMPLATE_UPDATE',
      resourceType: 'metadata_template',
      resourceId: id,
      roomId: null,
      user,
      details: { updates: Object.keys(updates) },
      request,
    });

    const updated = await db.collection('dataroom_metadata_templates').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updated);

  } catch (error) {
    console.error('PUT /api/dataroom/metadata-templates/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/dataroom/metadata-templates/[id] - Delete template
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const template = await db.collection('dataroom_metadata_templates').findOne({
      _id: new ObjectId(id),
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Soft delete
    await db.collection('dataroom_metadata_templates').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: user._id.toString(),
        },
      }
    );

    await logAudit({
      action: 'TEMPLATE_DELETE',
      resourceType: 'metadata_template',
      resourceId: id,
      roomId: null,
      user,
      details: { name: template.name, documentType: template.documentType },
      request,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/dataroom/metadata-templates/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
