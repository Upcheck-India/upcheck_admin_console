import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

// Check if user has permission to distribute apps
async function canUserDistribute(user, db) {
  const userRole = (user.role || 'member').toLowerCase();
  if (userRole === 'admin' || userRole === 'console admin' || userRole === 'console_admin') return true;

  const settings = await db.collection('appstore_settings').findOne({});
  if (!settings) return false; // Default to admins only

  if (settings.allowAnyoneToDistribute) return true;

  // Check roles whitelist
  if (settings.distributionRoles?.includes(userRole)) return true;

  // Check user whitelist
  if (settings.distributionUsers?.includes(user._id.toString())) return true;

  // Check teams whitelist
  if (settings.distributionTeams && settings.distributionTeams.length > 0) {
    const userTeams = await db.collection('teams').find({
      members: user._id.toString()
    }).toArray();
    const teamIds = userTeams.map(t => t._id.toString());
    const hasMatchingTeam = teamIds.some(id => settings.distributionTeams.includes(id));
    if (hasMatchingTeam) return true;
  }

  return false;
}

// GET list of accessible apps
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    // Check global download settings
    const settings = await db.collection('appstore_settings').findOne({});
    const isGlobalDownloadAllowed = settings ? settings.allowAnyoneToDownload : true;
    
    const userRole = (user.role || 'member').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'console admin' || userRole === 'console_admin';

    if (!isGlobalDownloadAllowed && !isAdmin) {
      // Forbidden by global settings
      return NextResponse.json({ success: true, apps: [], canDistribute: false });
    }

    // Fetch user's team IDs
    const userTeams = await db.collection('teams').find({
      members: user._id.toString()
    }).toArray();
    const teamIds = userTeams.map(t => t._id.toString());

    // Fetch all apps from collection
    const apps = await db.collection('appstore_apps').find({}).sort({ updatedAt: -1 }).toArray();

    // Determine if current user is allowed to distribute/upload apps
    const canDistribute = await canUserDistribute(user, db);

    // Filter apps based on RBAC and app-specific accessSettings
    const filteredApps = apps.filter(app => {
      // Hide apps unless user is Admin or the distributor
      if (app.status === 'hidden' && !isAdmin && app.distributorId !== user._id.toString()) {
        return false;
      }

      if (isAdmin) return true;
      if (app.distributorId === user._id.toString()) return true;

      const access = app.accessSettings;
      if (access && !access.availableToAll) {
        const allowedRoles = access.allowedRoles || [];
        const allowedUsers = access.allowedUsers || [];
        const allowedTeams = access.allowedTeams || [];

        const roleMatch = allowedRoles.includes(userRole);
        const userMatch = allowedUsers.includes(user._id.toString());
        const teamMatch = allowedTeams.some(id => teamIds.includes(id.toString()));

        if (!roleMatch && !userMatch && !teamMatch) {
          return false; // No view access
        }
      }
      return true;
    }).map(app => {
      // Determine download permission
      let canDownload = true;
      if (app.status === 'decommissioned' && !isAdmin && app.distributorId !== user._id.toString()) {
        canDownload = false;
      } else if (!isAdmin && app.distributorId !== user._id.toString()) {
        const downloadPerms = app.accessSettings?.downloadPermissions;
        if (downloadPerms?.restricted) {
          const allowedRoles = downloadPerms.allowedRoles || [];
          const allowedUsers = downloadPerms.allowedUsers || [];
          const allowedTeams = downloadPerms.allowedTeams || [];

          const roleMatch = allowedRoles.includes(userRole);
          const userMatch = allowedUsers.includes(user._id.toString());
          const teamMatch = allowedTeams.some(id => teamIds.includes(id.toString()));

          if (!roleMatch && !userMatch && !teamMatch) {
            canDownload = false; // View only, download restricted
          }
        }
      }

      // Check if user is subscribed to update notifications
      const isSubscribed = (app.subscribers || []).includes(user._id.toString());

      return {
        ...app,
        _id: app._id.toString(),
        canDownload,
        isSubscribed
      };
    });

    return NextResponse.json({
      success: true,
      apps: filteredApps,
      canDistribute
    });
  } catch (error) {
    console.error('App Store apps GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST to publish a new app (Wizard Step 1 metadata)
export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    // Check distribution rights
    const allowed = await canUserDistribute(user, db);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to publish apps' }, { status: 403 });
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
      accessSettings
    } = body;

    if (!name || !description || !category) {
      return NextResponse.json({ error: 'Name, description, and category are required' }, { status: 400 });
    }

    const distributorName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.username;

    const newApp = {
      name: name.trim(),
      projectId: projectId ? projectId.toString() : null,
      author: (author || distributorName).trim(),
      distributor: distributorName,
      distributorId: user._id.toString(),
      description: description.trim(),
      icon: icon || 'Smartphone',
      category: category.trim(),
      tags: Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()) : [],
      teamId: teamId ? teamId.toString() : null,
      subscribers: [],
      ratings: [],
      averageRating: 0,
      versions: [],
      latestVersion: '',
      downloadCount: 0,
      accessSettings: {
        availableToAll: accessSettings?.availableToAll !== false,
        allowedRoles: accessSettings?.allowedRoles || [],
        allowedTeams: (accessSettings?.allowedTeams || []).map(id => id.toString()),
        allowedUsers: (accessSettings?.allowedUsers || []).map(id => id.toString()),
        downloadPermissions: {
          restricted: !!accessSettings?.downloadPermissions?.restricted,
          allowedRoles: accessSettings?.downloadPermissions?.allowedRoles || [],
          allowedTeams: (accessSettings?.downloadPermissions?.allowedTeams || []).map(id => id.toString()),
          allowedUsers: (accessSettings?.downloadPermissions?.allowedUsers || []).map(id => id.toString())
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('appstore_apps').insertOne(newApp);

    return NextResponse.json({
      success: true,
      appId: result.insertedId.toString(),
      app: {
        ...newApp,
        _id: result.insertedId.toString()
      }
    });
  } catch (error) {
    console.error('App Store apps POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
