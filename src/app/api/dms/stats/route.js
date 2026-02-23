import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

export async function GET(request) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');

    // Get counts in parallel
    const [
      dataroomDocuments,
      documentationResources,
      dataroomRooms,
      dataroomUsers,
      externalUsers,
      adminUsers,
      auditLogs,
      dataroomFiles,
      storageStats
    ] = await Promise.all([
      // Dataroom documents
      db.collection('dataroom_documents').countDocuments({ isDeleted: { $ne: true } }),
      
      // Documentation resources
      db.collection('resources').countDocuments(),
      
      // Dataroom rooms
      db.collection('dataroom_rooms').countDocuments({ isDeleted: { $ne: true } }),
      
      // Dataroom internal users (staff)
      db.collection('dataroom_permissions').distinct('userId'),
      
      // External users
      db.collection('dataroom_external_users').countDocuments({ status: 'active' }),
      
      // Admin users (from admin_users collection)
      db.collection('admin_users').countDocuments(),
      
      // Recent audit log entries (last 24 hours)
      db.collection('dataroom_audit_log').countDocuments({
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      
      // GridFS files for dataroom
      db.collection('dataroom_files.files').find({}).toArray(),
      
      // Get storage stats from GridFS
      db.collection('dataroom_files.files').aggregate([
        {
          $group: {
            _id: null,
            totalSize: { $sum: '$length' }
          }
        }
      ]).toArray()
    ]);

    // Calculate total storage used
    const dataroomStorage = storageStats.length > 0 ? storageStats[0].totalSize : 0;
    
    // Get documentation storage (if stored in GridFS or calculate from resources)
    const documentationStorage = await db.collection('resources').aggregate([
      {
        $group: {
          _id: null,
          totalSize: { $sum: { $ifNull: ['$size', 0] } }
        }
      }
    ]).toArray();

    const docStorage = documentationStorage.length > 0 ? documentationStorage[0].totalSize : 0;
    const totalStorage = dataroomStorage + docStorage;

    // Format storage size
    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    const stats = {
      totalDocuments: dataroomDocuments + documentationResources,
      dataroomDocuments,
      documentationResources,
      dataroomRooms,
      activeUsers: dataroomUsers.length + externalUsers + adminUsers,
      internalUsers: dataroomUsers.length + adminUsers,
      externalUsers,
      storageUsed: formatBytes(totalStorage),
      storageBytes: totalStorage,
      securityEvents: 0, // Count failed login attempts or security-related audit logs
      recentActivity: auditLogs,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching DMS stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
