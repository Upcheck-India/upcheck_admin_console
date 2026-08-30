import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';

// PUT /api/dataroom/rooms/[id]/branding - Set room branding
export const PUT = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    const body = await request.json();
    const { 
      logo, // URL or base64
      companyName,
      primaryColor,
      secondaryColor,
      accentColor,
      headerText,
      footerText,
      customCSS,
      emailTemplateHeader,
      emailTemplateFooter,
    } = body;

    // Verify room exists
    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Build branding object
    const branding = {
      logo: logo || null,
      companyName: companyName || room.name,
      colors: {
        primary: primaryColor || '#1e40af',
        secondary: secondaryColor || '#64748b',
        accent: accentColor || '#3b82f6',
      },
      text: {
        header: headerText || `Welcome to ${room.name}`,
        footer: footerText || 'Confidential - Do Not Distribute',
      },
      customCSS: customCSS || '',
      emailTemplate: {
        header: emailTemplateHeader || `<h1>${room.name}</h1>`,
        footer: emailTemplateFooter || '<p>© 2026 All Rights Reserved</p>',
      },
      updatedAt: new Date(),
      updatedBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
    };

    // Update room with branding
    await db.collection('dataroom_rooms').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          branding,
          updatedAt: new Date(),
        },
      }
    );

    await logAudit({
      action: AUDIT_ACTIONS.ROOM_BRANDING_UPDATED,
      resourceType: 'room',
      resourceId: new ObjectId(id),
      roomId: new ObjectId(id),
      user,
      details: {
        companyName: branding.companyName,
        hasLogo: !!logo,
      },
      request,
    });

    return NextResponse.json({
      message: 'Room branding updated successfully',
      branding,
    });
  },
  {
    requires: 'view',
    resource: { type: 'room', param: 'id' },
  },
);

// GET /api/dataroom/rooms/[id]/branding - Get room branding
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    const room = await db.collection('dataroom_rooms').findOne(
      {
        _id: new ObjectId(id),
        isDeleted: { $ne: true },
      },
      { projection: { branding: 1, name: 1 } }
    );

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Return default branding if none set
    const branding = room.branding || {
      logo: null,
      companyName: room.name,
      colors: {
        primary: '#1e40af',
        secondary: '#64748b',
        accent: '#3b82f6',
      },
      text: {
        header: `Welcome to ${room.name}`,
        footer: 'Confidential - Do Not Distribute',
      },
      customCSS: '',
      emailTemplate: {
        header: `<h1>${room.name}</h1>`,
        footer: '<p>© 2026 All Rights Reserved</p>',
      },
    };

    return NextResponse.json({ branding });
  },
  {
    requires: 'admin',
    resource: { type: 'room', param: 'id' },
  },
);
