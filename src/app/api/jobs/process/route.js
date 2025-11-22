import { NextResponse } from 'next/server';
import { startJobProcessing } from '../../../../lib/jobHandlers.js';
import { connectToDatabase } from '../../../../lib/mongodb.js';
import ScheduledJob from '../../../../models/ScheduledJob.js';

// Initialize job processing
let initialized = false;
if (!initialized) {
  startJobProcessing();
  initialized = true;
}

export async function POST() {
  try {
    console.log('Manual job processing triggered');
    
    await connectToDatabase();
    
    // Get pending jobs
    const pendingJobs = await ScheduledJob.find({
      status: 'pending',
      executeAt: { $lte: new Date() }
    }).sort({ executeAt: 1 }).limit(10);
    
    console.log(`Found ${pendingJobs.length} pending jobs to process`);
    
    const results = [];
    
    for (const job of pendingJobs) {
      try {
        console.log(`Processing job ${job._id} of type ${job.type}`);
        
        // Import the job scheduler to access the job processor
        const { default: jobScheduler } = await import('../../../../lib/scheduler.js');
        
        // Process the job manually
        await jobScheduler.processJob(job);
        
        results.push({
          jobId: job._id,
          type: job.type,
          status: 'processed'
        });
        
      } catch (error) {
        console.error(`Error processing job ${job._id}:`, error);
        results.push({
          jobId: job._id,
          type: job.type,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });
    
  } catch (error) {
    console.error('Error in manual job processing:', error);
    return NextResponse.json({
      error: 'Failed to process jobs',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectToDatabase();
    
    // Get job statistics
    const pendingJobs = await ScheduledJob.countDocuments({ status: 'pending' });
    const processingJobs = await ScheduledJob.countDocuments({ status: 'processing' });
    const completedJobs = await ScheduledJob.countDocuments({ status: 'completed' });
    const failedJobs = await ScheduledJob.countDocuments({ status: 'failed' });
    
    // Get recent jobs
    const recentJobs = await ScheduledJob.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('type status executeAt createdAt error');
    
    return NextResponse.json({
      stats: {
        pending: pendingJobs,
        processing: processingJobs,
        completed: completedJobs,
        failed: failedJobs
      },
      recentJobs
    });
    
  } catch (error) {
    console.error('Error getting job stats:', error);
    return NextResponse.json({
      error: 'Failed to get job stats',
      details: error.message
    }, { status: 500 });
  }
}