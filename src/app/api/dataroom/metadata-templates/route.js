import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/metadata-templates - List metadata templates
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('documentType');

    const filter = { isDeleted: { $ne: true } };
    if (documentType) {
      filter.documentType = documentType;
    }

    const templates = await db.collection('dataroom_metadata_templates')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ count: templates.length, items: templates });
  },
  {
    requires: 'view',
    resource: { type: 'room', query: 'roomId' },
  },
);

// POST /api/dataroom/metadata-templates - Create metadata template
export const POST = withDataroomAuth(
  async (request, { user, db, params }) => {

    const body = await request.json();
    const {
      name,
      documentType = 'document',
      description = '',
      fields = [],
      isDefault = false,
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json({ error: 'At least one field is required' }, { status: 400 });
    }

    // Validate field structure
    for (const field of fields) {
      if (!field.name || !field.type) {
        return NextResponse.json({ error: 'Each field must have name and type' }, { status: 400 });
      }
      if (!['text', 'number', 'date', 'select', 'multiselect', 'boolean', 'textarea'].includes(field.type)) {
        return NextResponse.json({ error: `Invalid field type: ${field.type}` }, { status: 400 });
      }
    }

    // Check for duplicate template name
    const existing = await db.collection('dataroom_metadata_templates').findOne({
      name: name.trim(),
      documentType,
      isDeleted: { $ne: true },
    });

    if (existing) {
      return NextResponse.json({ error: 'A template with this name already exists for this document type' }, { status: 409 });
    }

    const newTemplate = {
      name: name.trim(),
      documentType,
      description: description.trim(),
      fields: fields.map(f => ({
        name: f.name.trim(),
        type: f.type,
        label: f.label || f.name.trim(),
        placeholder: f.placeholder || '',
        required: f.required || false,
        validation: f.validation || null,
        options: f.options || [],
        defaultValue: f.defaultValue || null,
        helpText: f.helpText || '',
      })),
      isDefault,
      isDeleted: false,
      createdAt: new Date(),
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      updatedAt: new Date(),
    };

    const result = await db.collection('dataroom_metadata_templates').insertOne(newTemplate);

    await logAudit({
      action: 'TEMPLATE_CREATE',
      resourceType: 'metadata_template',
      resourceId: result.insertedId,
      roomId: null,
      user,
      details: { name: newTemplate.name, documentType, fieldCount: fields.length },
      request,
    });

    return NextResponse.json({ ...newTemplate, _id: result.insertedId }, { status: 201 });
  },
  {
    requires: 'admin',
    resource: { type: 'room', query: 'roomId' },
  },
);
