import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import jobScheduler, { scheduleJob, registerJobHandler } from '../scheduler.js';
import ScheduledJob from '../../models/ScheduledJob.js';

// Mock the database connection
vi.mock('../mongodb.js', () => ({
  connectToDatabase: vi.fn().mockResolvedValue(true)
}));

// Mock the ScheduledJob model
vi.mock('../../models/ScheduledJob.js', () => {
  const mockJob = {
    _id: 'test-job-id',
    type: 'test_job',
    status: 'pending',
    payload: { test: 'data' },
    scheduling: {
      executeAt: new Date(),
      retryCount: 0,
      maxRetries: 3
    },
    save: vi.fn().mockResolvedValue(true),
    markStarted: vi.fn().mockResolvedValue(true),
    markCompleted: vi.fn().mockResolvedValue(true),
    markFailed: vi.fn().mockResolvedValue(true),
    scheduleRetry: vi.fn().mockResolvedValue(true),
    canRetry: true
  };

  return {
    default: {
      getPendingJobs: vi.fn().mockResolvedValue([mockJob]),
      cleanupOldJobs: vi.fn().mockResolvedValue({ deletedCount: 5 }),
      findById: vi.fn().mockResolvedValue(mockJob),
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([mockJob])
        })
      }),
      aggregate: vi.fn().mockResolvedValue([
        { _id: 'pending', count: 5 },
        { _id: 'completed', count: 10 }
      ])
    },
    mockJob
  };
});

describe('JobScheduler', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await jobScheduler.initialize();
  });

  afterEach(async () => {
    await jobScheduler.stop();
  });

  test('should initialize successfully', async () => {
    const result = await jobScheduler.initialize();
    expect(result).toBe(true);
  });

  test('should register job handlers', () => {
    const handler = vi.fn();
    registerJobHandler('test_job', handler);
    
    expect(jobScheduler.jobHandlers.get('test_job')).toBe(handler);
  });

  test('should schedule a job', async () => {
    // Add test_job to retry config
    jobScheduler.config.retryConfig.test_job = {
      maxRetries: 3,
      backoffMs: [1000, 5000, 15000]
    };

    const job = await scheduleJob('test_job', { test: 'data' });
    expect(job).toBeDefined();
  });

  test('should reject unknown job types', async () => {
    await expect(scheduleJob('unknown_job', {})).rejects.toThrow('Unknown job type: unknown_job');
  });

  test('should get job statistics', () => {
    const stats = jobScheduler.getStats();
    expect(stats).toHaveProperty('processed');
    expect(stats).toHaveProperty('failed');
    expect(stats).toHaveProperty('retried');
    expect(stats).toHaveProperty('isRunning');
  });

  test('should get job counts', async () => {
    const counts = await jobScheduler.getJobCounts();
    expect(counts).toHaveProperty('pending');
    expect(counts).toHaveProperty('completed');
    expect(counts.pending).toBe(5);
    expect(counts.completed).toBe(10);
  });

  test('should process jobs with registered handlers', async () => {
    const handler = vi.fn().mockResolvedValue('success');
    registerJobHandler('test_job', handler);
    
    // Mock the job processing
    const { mockJob } = await import('../../models/ScheduledJob.js');
    mockJob.type = 'test_job';
    
    await jobScheduler.processJob(mockJob);
    
    expect(handler).toHaveBeenCalledWith(mockJob.payload);
    expect(mockJob.markStarted).toHaveBeenCalled();
    expect(mockJob.markCompleted).toHaveBeenCalled();
  });

  test('should handle job failures and retries', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Job failed'));
    registerJobHandler('test_job', handler);
    
    const { mockJob } = await import('../../models/ScheduledJob.js');
    mockJob.type = 'test_job';
    
    await jobScheduler.processJob(mockJob);
    
    expect(mockJob.markFailed).toHaveBeenCalled();
    expect(mockJob.scheduleRetry).toHaveBeenCalled();
  });

  test('should cancel jobs', async () => {
    const { mockJob } = await import('../../models/ScheduledJob.js');
    const result = await jobScheduler.cancelJob('test-job-id');
    
    expect(result).toBeDefined();
    expect(mockJob.save).toHaveBeenCalled();
  });

  test('should get jobs by series', async () => {
    const jobs = await jobScheduler.getJobsBySeries('series-123');
    expect(jobs).toBeDefined();
    expect(Array.isArray(jobs)).toBe(true);
  });
});