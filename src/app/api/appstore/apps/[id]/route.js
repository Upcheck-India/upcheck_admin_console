import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/auth';
import { GridFSBucket, ObjectId } from 'mongodb';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid app ID' }, { status: 400 });
    }

    const app = await db.collection('appstore_apps').findOne({ _id: new ObjectId(id) });
    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    const userRole = (user.role || 'member').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'console admin' || userRole === 'console_admin';

    // Verify view rights
    if (!isAdmin && app.distributorId !== user._id.toString()) {
      const access = app.accessSettings;
      if (access && !access.availableToAll) {
        const userTeams = await db.collection('teams').find({
          members: user._id.toString()
        }).toArray();
        const teamIds = userTeams.map(t => t._id.toString());

        const roleMatch = (access.allowedRoles || []).includes(userRole);
        const userMatch = (access.allowedUsers || []).includes(user._id.toString());
        const teamMatch = (access.allowedTeams || []).some(tId => teamIds.includes(tId.toString()));

        if (!roleMatch && !userMatch && !teamMatch) {
          return NextResponse.json({ error: 'Forbidden: You do not have access to view this app' }, { status: 403 });
        }
      }
    }

    // Verify download rights
    let canDownload = true;
    if (!isAdmin && app.distributorId !== user._id.toString()) {
      const downloadPerms = app.accessSettings?.downloadPermissions;
      if (downloadPerms?.restricted) {
        const userTeams = await db.collection('teams').find({
          members: user._id.toString()
        }).toArray();
        const teamIds = userTeams.map(t => t._id.toString());

        const roleMatch = (downloadPerms.allowedRoles || []).includes(userRole);
        const userMatch = (downloadPerms.allowedUsers || []).includes(user._id.toString());
        const teamMatch = (downloadPerms.allowedTeams || []).some(tId => teamIds.includes(tId.toString()));

        if (!roleMatch && !userMatch && !teamMatch) {
          canDownload = false;
        }
      }
    }

    const isSubscribed = (app.subscribers || []).includes(user._id.toString());

    return NextResponse.json({
      success: true,
      app: {
        ...app,
        _id: app._id.toString(),
        canDownload,
        isSubscribed
      }
    });
  } catch (error) {
    console.error('App Store apps single GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid app ID' }, { status: 400 });
    }

    const app = await db.collection('appstore_apps').findOne({ _id: new ObjectId(id) });
    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    const userRole = (user.role || 'member').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'console admin' || userRole === 'console_admin';
    const isDistributor = app.distributorId === user._id.toString();

    if (!isAdmin && !isDistributor) {
      return NextResponse.json({ error: 'Forbidden: Only admins or the original publisher can edit this app' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      projectId,
      author,
      description,
      icon,
      category,
      tags,
      teamId,
      accessSettings,
      status
    } = body;

    const updateDoc = {};
    if (status !== undefined) {
      if (['active', 'decommissioned', 'hidden'].includes(status)) {
        updateDoc.status = status;
      }
    }
    if (name) updateDoc.name = name.trim();
    if (projectId !== undefined) updateDoc.projectId = projectId ? projectId.toString() : null;
    if (author) updateDoc.author = author.trim();
    if (description) updateDoc.description = description.trim();
    if (icon) updateDoc.icon = icon;
    if (category) updateDoc.category = category.trim();
    if (tags) updateDoc.tags = Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()) : [];
    if (teamId !== undefined) updateDoc.teamId = teamId ? teamId.toString() : null;

    if (accessSettings) {
      updateDoc.accessSettings = {
        availableToAll: accessSettings.availableToAll !== false,
        allowedRoles: accessSettings.allowedRoles || [],
        allowedTeams: (accessSettings.allowedTeams || []).map(id => id.toString()),
        allowedUsers: (accessSettings.allowedUsers || []).map(id => id.toString()),
        downloadPermissions: {
          restricted: !!accessSettings.downloadPermissions?.restricted,
          allowedRoles: accessSettings.downloadPermissions?.allowedRoles || [],
          allowedTeams: (accessSettings.downloadPermissions?.allowedTeams || []).map(id => id.toString()),
          allowedUsers: (accessSettings.downloadPermissions?.allowedUsers || []).map(id => id.toString())
        }
      };
    }

    updateDoc.updatedAt = new Date();

    const result = await db.collection('appstore_apps').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    return NextResponse.json({ success: true, app: result });
  } catch (error) {
    console.error('App Store apps single PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid app ID' }, { status: 400 });
    }

    const app = await db.collection('appstore_apps').findOne({ _id: new ObjectId(id) });
    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    const userRole = (user.role || 'member').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'console admin' || userRole === 'console_admin';
    const isDistributor = app.distributorId === user._id.toString();

    if (!isAdmin && !isDistributor) {
      return NextResponse.json({ error: 'Forbidden: Only admins or the original publisher can delete this app' }, { status: 403 });
    }

    // 1. Delete all version files from GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'appstore_apks' });
    const versions = app.versions || [];
    for (const v of versions) {
      if (v.fileId) {
        await bucket.delete(new ObjectId(v.fileId)).catch(() => {});
      }
    }

    // 2. Delete app metadata document
    await db.collection('appstore_apps').deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ success: true, message: 'App and all associated files deleted successfully' });
  } catch (error) {
    console.error('App Store apps single DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
