import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth, roomOf } from '../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/metadata-templates/[id] - Get single template
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const template = await db.collection('dataroom_metadata_templates').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  },
  {
    requires: 'view',
    resolve: roomOf('dataroom_metadata_templates', 'id'),
  },
);

// PUT /api/dataroom/metadata-templates/[id] - Update template
export const PUT = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, fields, isDefault } = body;

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
  },
  {
    requires: 'admin',
    resolve: roomOf('dataroom_metadata_templates', 'id'),
  },
);

// DELETE /api/dataroom/metadata-templates/[id] - Delete template
export const DELETE = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

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
  },
  {
    requires: 'admin',
    resolve: roomOf('dataroom_metadata_templates', 'id'),
  },
);
