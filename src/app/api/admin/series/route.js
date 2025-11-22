/**
 * Admin Series Management API
 * Provides bulk operations and management for recurring series
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb.js';
import RecurringSeries from '../../../../models/RecurringSeries.js';
import Event from '../../../../models/Event.js';
import ScheduledJob from '../../../../models/ScheduledJob.js';
import { cancelJob } from '../../../../lib/scheduler.js';
import { adminNotificationManager } from '../../../../lib/adminNotifications.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const page = parseInt(searchParams.get('page')) || 1;
    const action = searchParams.get('action');
    const seriesId = searchParams.get('seriesId');

    await connectToDatabase();

    if (action === 'stats') {
      // Get series statistics
      const totalSeries = await RecurringSeries.countDocuments();
      const activeSeries = await RecurringSeries.countDocuments({ status: 'active' });
      const pausedSeries = await RecurringSeries.countDocuments({ status: 'paused' });
      const completedSeries = await RecurringSeries.countDocuments({ status: 'completed' });
      
      // Get series with issues
      const seriesWithFailures = await RecurringSeries.countDocuments({
        'metadata.lastJobFailure': { $exists: true }
      });

      return NextResponse.json({
        success: true,
        data: {
          total: totalSeries,
          active: activeSeries,
          paused: pausedSeries,
          completed: completedSeries,
          withFailures: seriesWithFailures
        }
      });
    }

    if (action === 'details' && seriesId) {
      // Get detailed series information
      const series = await RecurringSeries.findById(seriesId);
      if (!series) {
        return NextResponse.json({
          success: false,
          error: 'Series not found'
        }, { status: 404 });
      }

      // Get related events count
      const eventsCount = await Event.countDocuments({ seriesId });
      
      // Get pending jobs for this series
      const pendingJobs = await ScheduledJob.countDocuments({
        'data.seriesId': seriesId,
        status: { $in: ['pending', 'running'] }
      });

      return NextResponse.json({
        success: true,
        data: {
          series,
          eventsCount,
          pendingJobs
        }
      });
    }

    // Build query
    const query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;

    // Get series with pagination
    const skip = (page - 1) * limit;
    const series = await RecurringSeries.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email');

    const total = await RecurringSeries.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: {
        series,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Admin series GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch series data'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, seriesIds, data } = body;

    await connectToDatabase();

    switch (action) {
      case 'bulk_pause':
        await RecurringSeries.updateMany(
          { _id: { $in: seriesIds } },
          { 
            status: 'paused',
            'metadata.pausedAt': new Date(),
            'metadata.pausedBy': 'admin'
          }
        );

        // Cancel pending jobs for paused series
        for (const seriesId of seriesIds) {
          await ScheduledJob.updateMany(
            { 'data.seriesId': seriesId, status: 'pending' },
            { status: 'cancelled', cancelledAt: new Date() }
          );
        }

        adminNotificationManager.notify({
          type: 'admin_action',
          severity: 'info',
          message: `Bulk paused ${seriesIds.length} recurring series`,
          metadata: { seriesIds, action: 'bulk_pause' }
        });

        return NextResponse.json({
          success: true,
          message: `Paused ${seriesIds.length} series`
        });

      case 'bulk_resume':
        await RecurringSeries.updateMany(
          { _id: { $in: seriesIds } },
          { 
            status: 'active',
            $unset: { 'metadata.pausedAt': '', 'metadata.pausedBy': '' }
          }
        );

        adminNotificationManager.notify({
          type: 'admin_action',
          severity: 'info',
          message: `Bulk resumed ${seriesIds.length} recurring series`,
          metadata: { seriesIds, action: 'bulk_resume' }
        });

        return NextResponse.json({
          success: true,
          message: `Resumed ${seriesIds.length} series`
        });

      case 'bulk_delete':
        // Delete series and related data
        for (const seriesId of seriesIds) {
          // Cancel pending jobs
          await ScheduledJob.updateMany(
            { 'data.seriesId': seriesId, status: 'pending' },
            { status: 'cancelled', cancelledAt: new Date() }
          );

          // Mark events as cancelled (don't delete for audit trail)
          await Event.updateMany(
            { seriesId },
            { status: 'cancelled', cancelledAt: new Date() }
          );
        }

        // Delete the series
        await RecurringSeries.deleteMany({ _id: { $in: seriesIds } });

        adminNotificationManager.notify({
          type: 'admin_action',
          severity: 'warning',
          message: `Bulk deleted ${seriesIds.length} recurring series`,
          metadata: { seriesIds, action: 'bulk_delete' }
        });

        return NextResponse.json({
          success: true,
          message: `Deleted ${seriesIds.length} series`
        });

      case 'retry_failed_jobs':
        // Retry failed jobs for specified series
        let retriedCount = 0;
        for (const seriesId of seriesIds) {
          const failedJobs = await ScheduledJob.find({
            'data.seriesId': seriesId,
            status: 'failed'
          });

          for (const job of failedJobs) {
            job.status = 'pending';
            job.retryCount = 0;
            job.scheduledFor = new Date();
            job.error = null;
            await job.save();
            retriedCount++;
          }
        }

        adminNotificationManager.notify({
          type: 'admin_action',
          severity: 'info',
          message: `Retried ${retriedCount} failed jobs for ${seriesIds.length} series`,
          metadata: { seriesIds, retriedCount, action: 'retry_failed_jobs' }
        });

        return NextResponse.json({
          success: true,
          message: `Retried ${retriedCount} failed jobs`
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Admin series POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to perform bulk operation'
    }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { seriesId, updates } = body;

    await connectToDatabase();

    const series = await RecurringSeries.findById(seriesId);
    if (!series) {
      return NextResponse.json({
        success: false,
        error: 'Series not found'
      }, { status: 404 });
    }

    // Update series with admin override
    Object.assign(series, updates);
    series.metadata = series.metadata || {};
    series.metadata.lastAdminUpdate = new Date();
    
    await series.save();

    adminNotificationManager.notify({
      type: 'admin_action',
      severity: 'info',
      message: `Admin updated recurring series: ${series.title}`,
      metadata: { seriesId, updates }
    });

    return NextResponse.json({
      success: true,
      data: series
    });

  } catch (error) {
    console.error('Admin series PUT error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update series'
    }, { status: 500 });
  }
}