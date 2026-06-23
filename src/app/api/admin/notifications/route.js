/**
 * Admin Notifications API
 * Manages admin notifications and alerts
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb.js';
import { getAdminNotificationHistory, adminNotificationManager } from '../../../../lib/adminNotifications.js';
import { alertSystem } from '../../../../lib/monitoring.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours')) || 24;
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const acknowledged = searchParams.get('acknowledged');
    const source = searchParams.get('source') || 'all'; // 'memory', 'database', 'all'

    let notifications = [];

    if (source === 'memory' || source === 'all') {
      // Get notifications from memory (recent)
      const memoryNotifications = getAdminNotificationHistory(hours);
      notifications = notifications.concat(memoryNotifications.map(n => ({
        ...n,
        source: 'memory'
      })));
    }

    if (source === 'database' || source === 'all') {
      // Get notifications from database
      const connection = await connectToDatabase();
      const db = connection.db || global.mongoose?.connection?.db || connection.useDb('resources').db;
      
      const query = {
        createdAt: { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) }
      };
      
      if (type) query.type = type;
      if (severity) query.severity = severity;
      if (acknowledged !== null) query.acknowledged = acknowledged === 'true';

      const dbNotifications = await db.collection('admin_notifications')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

      notifications = notifications.concat(dbNotifications.map(n => ({
        ...n,
        source: 'database'
      })));
    }

    // Remove duplicates and sort by timestamp
    const uniqueNotifications = notifications.reduce((acc, notification) => {
      const existing = acc.find(n => n.id === notification.id);
      if (!existing) {
        acc.push(notification);
      }
      return acc;
    }, []);

    uniqueNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return NextResponse.json({
      success: true,
      data: uniqueNotifications,
      count: uniqueNotifications.length,
      filters: { hours, type, severity, acknowledged, source }
    });

  } catch (error) {
    console.error('Error getting admin notifications:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get admin notifications',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { action, notificationId, notificationIds, data } = await request.json();

    const connection = await connectToDatabase();
    const db = connection.db || global.mongoose?.connection?.db || connection.useDb('resources').db;

    switch (action) {
      case 'acknowledge':
        if (notificationId) {
          // Acknowledge single notification
          await db.collection('admin_notifications').updateOne(
            { id: notificationId },
            { 
              $set: { 
                acknowledged: true,
                acknowledgedAt: new Date(),
                acknowledgedBy: data?.acknowledgedBy || 'admin'
              }
            }
          );
          
          return NextResponse.json({
            success: true,
            message: `Notification ${notificationId} acknowledged`
          });
        } else if (notificationIds && Array.isArray(notificationIds)) {
          // Acknowledge multiple notifications
          const result = await db.collection('admin_notifications').updateMany(
            { id: { $in: notificationIds } },
            { 
              $set: { 
                acknowledged: true,
                acknowledgedAt: new Date(),
                acknowledgedBy: data?.acknowledgedBy || 'admin'
              }
            }
          );
          
          return NextResponse.json({
            success: true,
            message: `Acknowledged ${result.modifiedCount} notifications`,
            modifiedCount: result.modifiedCount
          });
        }
        break;

      case 'dismiss':
        if (notificationId) {
          // Dismiss (delete) single notification
          await db.collection('admin_notifications').deleteOne({ id: notificationId });
          
          return NextResponse.json({
            success: true,
            message: `Notification ${notificationId} dismissed`
          });
        } else if (notificationIds && Array.isArray(notificationIds)) {
          // Dismiss multiple notifications
          const result = await db.collection('admin_notifications').deleteMany(
            { id: { $in: notificationIds } }
          );
          
          return NextResponse.json({
            success: true,
            message: `Dismissed ${result.deletedCount} notifications`,
            deletedCount: result.deletedCount
          });
        }
        break;

      case 'test':
        // Send test notification
        const { sendAdminNotification, NOTIFICATION_TYPES } = await import('../../../../lib/adminNotifications.js');
        
        await sendAdminNotification(NOTIFICATION_TYPES.SYSTEM_HEALTH, {
          status: 'test',
          score: 100,
          healthyChecks: 4,
          totalChecks: 4,
          criticalFailures: 0,
          failedChecks: [],
          message: 'This is a test notification from the admin dashboard'
        }, {
          severity: 'low',
          immediate: true
        });
        
        return NextResponse.json({
          success: true,
          message: 'Test notification sent'
        });

      case 'get-stats':
        // Get notification statistics
        const stats = await db.collection('admin_notifications').aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              acknowledged: {
                $sum: { $cond: ['$acknowledged', 1, 0] }
              },
              bySeverity: {
                $push: '$severity'
              },
              byType: {
                $push: '$type'
              }
            }
          }
        ]).toArray();

        const alertHistory = alertSystem.getAlertHistory(24);
        
        return NextResponse.json({
          success: true,
          data: {
            notifications: stats[0] || { total: 0, acknowledged: 0 },
            alerts: {
              total: alertHistory.length,
              bySeverity: alertHistory.reduce((acc, alert) => {
                acc[alert.severity] = (acc[alert.severity] || 0) + 1;
                return acc;
              }, {})
            }
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error handling notification action:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to handle notification action',
      details: error.message
    }, { status: 500 });
  }
}