import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { DEFAULT_PROVIDER_ID, PROVIDERS } from '../../../../lib/storage/index.js';

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { db } = auth;

    let settings = await db.collection('appstore_settings').findOne({});
    if (!settings) {
      settings = {
        distributionRoles: ['admin', 'console_admin'],
        distributionTeams: [],
        distributionUsers: [],
        excludedDistributionRoles: [],
        excludedDistributionTeams: [],
        excludedDistributionUsers: [],
        allowAnyoneToDistribute: false,
        allowAnyoneToDownload: true,
        uploadsDisabled: false,
        downloadsDisabled: false,
        updatesDisabled: false,
        storageProvider: DEFAULT_PROVIDER_ID,
        updatedAt: new Date()
      };
      await db.collection('appstore_settings').insertOne(settings);
    }
    // Backfill defaults for settings docs created before these fields existed.
    settings = {
      excludedDistributionRoles: [],
      excludedDistributionTeams: [],
      excludedDistributionUsers: [],
      uploadsDisabled: false,
      downloadsDisabled: false,
      updatesDisabled: false,
      storageProvider: DEFAULT_PROVIDER_ID,
      ...settings,
    };

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('App Store settings GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    // Enforce Admin RBAC check
    const userRole = (user.role || 'member').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'console admin' && userRole !== 'console_admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      distributionRoles,
      distributionTeams,
      distributionUsers,
      excludedDistributionRoles,
      excludedDistributionTeams,
      excludedDistributionUsers,
      allowAnyoneToDistribute,
      allowAnyoneToDownload,
      uploadsDisabled,
      downloadsDisabled,
      updatesDisabled,
      storageProvider,
    } = body;

    const updateDoc = {
      distributionRoles: distributionRoles || ['admin', 'console_admin'],
      distributionTeams: (distributionTeams || []).map(id => id.toString()),
      distributionUsers: (distributionUsers || []).map(id => id.toString()),
      excludedDistributionRoles: excludedDistributionRoles || [],
      excludedDistributionTeams: (excludedDistributionTeams || []).map(id => id.toString()),
      excludedDistributionUsers: (excludedDistributionUsers || []).map(id => id.toString()),
      allowAnyoneToDistribute: !!allowAnyoneToDistribute,
      allowAnyoneToDownload: allowAnyoneToDownload !== false,
      uploadsDisabled: !!uploadsDisabled,
      downloadsDisabled: !!downloadsDisabled,
      updatesDisabled: !!updatesDisabled,
      storageProvider: PROVIDERS[storageProvider] ? storageProvider : DEFAULT_PROVIDER_ID,
      updatedAt: new Date()
    };

    const result = await db.collection('appstore_settings').findOneAndUpdate(
      {},
      { $set: updateDoc },
      { upsert: true, returnDocument: 'after' }
    );

    return NextResponse.json({ success: true, settings: result });
  } catch (error) {
    console.error('App Store settings PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
