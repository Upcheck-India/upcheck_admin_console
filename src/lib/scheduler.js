import ScheduledJob from '../models/ScheduledJob.js';
import { connectToDatabase } from './mongodb.js';

/**
 * Job Scheduler Service
 * Manages background job processing with retry logic and error handling
 */
class JobScheduler {
  constructor() {
    this.isRunning = false;
    this.processingInterval = null;
    this.config = {
      // Processing intervals in milliseconds
      processingIntervalMs: 30000, // 30 seconds
      batchSize: 10, // Number of jobs to process per batch
      jobTimeoutMs: 300000, // 5 minutes default timeout
      
      // Retry configuration with exponential backoff
      retryConfig: {
        generate_meeting: { 
          maxRetries: 3, 
          backoffMs: [5000, 30000, 120000] // 5s, 30s, 2m
        },
        send_reminder: { 
          maxRetries: 5, 
          backoffMs: [2000, 10000, 30000, 60000, 300000] // 2s, 10s, 30s, 1m, 5m
        },
        send_series_notification: { 
          maxRetries: 3, 
          backoffMs: [5000, 30000, 120000] // 5s, 30s, 2m
        },
        cleanup: { 
          maxRetries: 2, 
          backoffMs: [60000, 300000] // 1m, 5m
        }
      },
      
      // Cleanup configuration
      cleanupIntervalMs: 3600000, // 1 hour
      jobRetentionDays: 30
    };
    
    this.jobHandlers = new Map();
    this.stats = {
      processed: 0,
      failed: 0,
      retried: 0,
      startTime: null
    };
  }

  /**
   * Initialize the job scheduler
   */
  async initialize() {
    try {
      await connectToDatabase();
      console.log('Job scheduler initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize job scheduler:', error);
      throw error;
    }
  }

  /**
   * Register a job handler for a specific job type
   */
  registerJobHandler(jobType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Job handler must be a function');
    }
    this.jobHandlers.set(jobType, handler);
    console.log(`Registered handler for job type: ${jobType}`);
  }

  /**
   * Schedule a new job
   */
  async scheduleJob(type, payload = {}, executeAt = new Date(), options = {}) {
    try {
      await connectToDatabase();
      
      const retryConfig = this.config.retryConfig[type];
      if (!retryConfig) {
        throw new Error(`Unknown job type: ${type}`);
      }

      const job = new ScheduledJob({
        type,
        payload,
        scheduling: {
          executeAt,
          maxRetries: retryConfig.maxRetries
        },
        priority: options.priority || 0,
        timeout: options.timeout || this.config.jobTimeoutMs
      });

      await job.save();
      console.log(`Scheduled job ${job._id} of type ${type} for ${executeAt}`);
      return job;
    } catch (error) {
      console.error('Failed to schedule job:', error);
      throw error;
    }
  }

  /**
   * Start the job processing loop
   */
  async start() {
    if (this.isRunning) {
      console.log('Job scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.stats.startTime = new Date();
    console.log('Starting job scheduler...');

    // Start main processing loop
    this.processingInterval = setInterval(async () => {
      try {
        await this.processJobs();
      } catch (error) {
        console.error('Error in job processing loop:', error);
      }
    }, this.config.processingIntervalMs);

    // Start cleanup loop
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupOldJobs();
      } catch (error) {
        console.error('Error in cleanup loop:', error);
      }
    }, this.config.cleanupIntervalMs);

    console.log('Job scheduler started successfully');
  }

  /**
   * Stop the job scheduler
   */
  async stop() {
    if (!this.isRunning) {
      console.log('Job scheduler is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    console.log('Job scheduler stopped');
  }

  /**
   * Process pending jobs
   */
  async processJobs() {
    try {
      await connectToDatabase();
      
      const pendingJobs = await ScheduledJob.getPendingJobs(this.config.batchSize);
      
      if (pendingJobs.length === 0) {
        return;
      }

      console.log(`Processing ${pendingJobs.length} pending jobs`);

      // Process jobs concurrently but with controlled concurrency
      const promises = pendingJobs.map(job => this.processJob(job));
      await Promise.allSettled(promises);
      
    } catch (error) {
      console.error('Error processing jobs:', error);
    }
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    const startTime = Date.now();
    let timeoutHandle;

    try {
      // Mark job as started
      await job.markStarted();
      
      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Job ${job._id} timed out after ${job.timeout}ms`));
        }, job.timeout);
      });

      // Get job handler
      const handler = this.jobHandlers.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      // Execute job with timeout
      const jobPromise = handler(job.payload);
      await Promise.race([jobPromise, timeoutPromise]);

      // Clear timeout and mark as completed
      clearTimeout(timeoutHandle);
      await job.markCompleted();
      
      this.stats.processed++;
      const duration = Date.now() - startTime;
      console.log(`Job ${job._id} completed successfully in ${duration}ms`);

    } catch (error) {
      clearTimeout(timeoutHandle);
      
      try {
        await job.markFailed(error);
        this.stats.failed++;
        
        console.error(`Job ${job._id} failed:`, error.message);

        // Schedule retry if possible
        if (job.canRetry) {
          const retryConfig = this.config.retryConfig[job.type];
          const retryIndex = Math.min(job.scheduling.retryCount - 1, retryConfig.backoffMs.length - 1);
          const delayMs = retryConfig.backoffMs[retryIndex];
          
          await job.scheduleRetry(delayMs);
          this.stats.retried++;
          
          console.log(`Job ${job._id} scheduled for retry in ${delayMs}ms (attempt ${job.scheduling.retryCount}/${job.scheduling.maxRetries})`);
        } else {
          console.error(`Job ${job._id} failed permanently after ${job.scheduling.retryCount} attempts`);
          await this.moveToDeadLetterQueue(job, error);
        }
      } catch (updateError) {
        console.error(`Failed to update job ${job._id} status:`, updateError);
      }
    }
  }

  /**
   * Move permanently failed jobs to dead letter queue
   */
  async moveToDeadLetterQueue(job, error) {
    try {
      const { deadLetterQueue, recordError, RecurringMeetingError, ERROR_TYPES } = await import('./errorHandling.js');
      
      // Convert error to our error type if needed
      const enhancedError = error instanceof RecurringMeetingError ? error : 
        new RecurringMeetingError(error.message, ERROR_TYPES.SYSTEM);

      // Move to dead letter queue
      await deadLetterQueue.moveToDeadLetterQueue(job, enhancedError, {
        jobScheduler: 'main',
        timestamp: new Date()
      });

      // Record error for monitoring
      await recordError(enhancedError, {
        jobId: job._id,
        jobType: job.type,
        retryCount: job.scheduling.retryCount
      });

      console.error(`Job ${job._id} moved to dead letter queue after ${job.scheduling.retryCount} attempts`);
      
    } catch (dlqError) {
      console.error('Failed to process dead letter queue:', dlqError);
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs() {
    try {
      await connectToDatabase();
      
      const result = await ScheduledJob.cleanupOldJobs(this.config.jobRetentionDays);
      
      if (result.deletedCount > 0) {
        console.log(`Cleaned up ${result.deletedCount} old jobs`);
      }
    } catch (error) {
      console.error('Error cleaning up old jobs:', error);
    }
  }

  /**
   * Get job statistics
   */
  getStats() {
    const uptime = this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0;
    
    return {
      ...this.stats,
      uptime,
      isRunning: this.isRunning,
      config: this.config
    };
  }

  /**
   * Get job counts by status
   */
  async getJobCounts() {
    try {
      await connectToDatabase();
      
      const counts = await ScheduledJob.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      };

      counts.forEach(item => {
        result[item._id] = item.count;
      });

      return result;
    } catch (error) {
      console.error('Error getting job counts:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled job
   */
  async cancelJob(jobId) {
    try {
      await connectToDatabase();
      
      const job = await ScheduledJob.findById(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (job.status === 'processing') {
        throw new Error(`Cannot cancel job ${jobId} - already processing`);
      }

      if (job.status === 'completed') {
        throw new Error(`Cannot cancel job ${jobId} - already completed`);
      }

      job.status = 'cancelled';
      await job.save();
      
      console.log(`Job ${jobId} cancelled`);
      return job;
    } catch (error) {
      console.error(`Error cancelling job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get jobs by series ID
   */
  async getJobsBySeries(seriesId, status = null) {
    try {
      await connectToDatabase();
      
      const query = { 'payload.seriesId': seriesId };
      if (status) {
        query.status = status;
      }

      return await ScheduledJob.find(query)
        .sort({ 'scheduling.executeAt': 1 })
        .lean();
    } catch (error) {
      console.error(`Error getting jobs for series ${seriesId}:`, error);
      throw error;
    }
  }
}

// Create singleton instance
const jobScheduler = new JobScheduler();

export default jobScheduler;

// Export utility functions
export const scheduleJob = (type, payload, executeAt, options) => 
  jobScheduler.scheduleJob(type, payload, executeAt, options);

export const registerJobHandler = (type, handler) => 
  jobScheduler.registerJobHandler(type, handler);

export const startScheduler = () => jobScheduler.start();
export const stopScheduler = () => jobScheduler.stop();
export const getSchedulerStats = () => jobScheduler.getStats();
export const getJobCounts = () => jobScheduler.getJobCounts();
export const cancelJob = (jobId) => jobScheduler.cancelJob(jobId);
export const getJobsBySeries = (seriesId, status) => jobScheduler.getJobsBySeries(seriesId, status);