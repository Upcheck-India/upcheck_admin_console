/**
 * Admin Jobs Management API
 * Provides job queue management and monitoring
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb.js';
import ScheduledJob from '../../../../models/ScheduledJob.js';
import { getJobCounts, cancelJob } from '../../../../lib/scheduler.js';
import { deadLetterQueue } from '../../../../lib/errorHandling.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const seriesId = searchParams.get('seriesId');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const page = parseInt(searchParams.get('page')) || 1;
    const action = searchParams.get('action');

    await connectToDatabase();

    if (action === 'counts') {
      // Get job counts by status
      const counts = await getJobCounts();
      
      return NextResponse.json({
        success: true,
        data: counts
      });
    }

    if (action === 'dead-letter') {
      // Get dead letter queue entries
      const entries = await deadLetterQueue.getDeadLetterEntries();
      
      return NextResponse.json({
        success: true,
        data: entries,
        count: entries.length
      });
    }

    // Build query
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (seriesId) query['payload.seriesId'] = seriesId;

    // Get jobs with pagination
    const skip = (page - 1) * limit;
    const jobs = await ScheduledJob.find(query)
      .sort({ 'scheduling.createdAt': -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ScheduledJob.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error getting jobs:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get jobs',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { action, jobId, jobIds, filters } = await request.json();

    await connectToDatabase();

    switch (action) {
      case 'cancel':
        if (jobId) {
          // Cancel single job
          const job = await cancelJob(jobId);
          
          return NextResponse.json({
            success: true,
            data: job,
            message: `Job ${jobId} cancelled`
          });
        } else if (jobIds && Array.isArray(jobIds)) {
          // Cancel multiple jobs
          const results = await Promise.allSettled(
            jobIds.map(id => cancelJob(id))
          );
          
          const successful = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;
          
          return NextResponse.json({
            success: true,
            message: `Cancelled ${successful} jobs, ${failed} failed`,
            results: {
              successful,
              failed,
              total: jobIds.length
            }
          });
        }
        break;

      case 'retry-dead-letter':
        if (jobId) {
          // Retry dead letter entry
          await deadLetterQueue.retryDeadLetterEntry(jobId);
          
          return NextResponse.json({
            success: true,
            message: `Dead letter entry ${jobId} retried`
          });
        }
        break;

      case 'resolve-dead-letter':
        const { resolution } = await request.json();
        if (jobId) {
          // Resolve dead letter entry
          await deadLetterQueue.resolveDeadLetterEntry(jobId, resolution);
          
          return NextResponse.json({
            success: true,
            message: `Dead letter entry ${jobId} resolved`
          });
        }
        break;

      case 'cleanup':
        // Clean up old jobs
        const { olderThanDays = 30 } = filters || {};
        const result = await ScheduledJob.cleanupOldJobs(olderThanDays);
        
        return NextResponse.json({
          success: true,
          message: `Cleaned up ${result.deletedCount} old jobs`,
          deletedCount: result.deletedCount
        });

      case 'bulk-cancel':
        // Cancel jobs matching filters
        const query = {};
        if (filters?.status) query.status = filters.status;
        if (filters?.type) query.type = filters.type;
        if (filters?.olderThan) {
          query['scheduling.createdAt'] = { 
            $lt: new Date(Date.now() - filters.olderThan * 24 * 60 * 60 * 1000) 
          };
        }

        const bulkResult = await ScheduledJob.updateMany(query, {
          status: 'cancelled',
          updatedAt: new Date()
        });
        
        return NextResponse.json({
          success: true,
          message: `Cancelled ${bulkResult.modifiedCount} jobs`,
          modifiedCount: bulkResult.modifiedCount
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error handling job action:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to handle job action',
      details: error.message
    }, { status: 500 });
  }
}