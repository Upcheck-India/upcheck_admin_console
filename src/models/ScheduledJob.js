import mongoose from 'mongoose';

const JobErrorSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  stack: String,
  lastFailedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const JobSchedulingSchema = new mongoose.Schema({
  executeAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  startedAt: Date,
  completedAt: Date,
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxRetries: {
    type: Number,
    default: 3,
    min: 0
  }
}, { _id: false });

const ScheduledJobSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['generate_meeting', 'send_reminder', 'cleanup', 'send_series_notification'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  // Job payload - flexible structure for different job types
  payload: {
    seriesId: mongoose.Schema.Types.ObjectId,
    meetingId: mongoose.Schema.Types.ObjectId,
    notificationId: mongoose.Schema.Types.ObjectId,
    // Additional job-specific data stored as mixed type
    data: mongoose.Schema.Types.Mixed
  },
  
  scheduling: {
    type: JobSchedulingSchema,
    required: true
  },
  
  error: JobErrorSchema,
  
  // Job priority (higher number = higher priority)
  priority: {
    type: Number,
    default: 0
  },
  
  // Job timeout in milliseconds
  timeout: {
    type: Number,
    default: 300000 // 5 minutes
  }
}, { 
  timestamps: true,
  collection: 'scheduled_jobs'
});

// Indexes for efficient job processing
ScheduledJobSchema.index({ 'scheduling.executeAt': 1, status: 1 });
ScheduledJobSchema.index({ type: 1, status: 1 });
ScheduledJobSchema.index({ 'payload.seriesId': 1 });
ScheduledJobSchema.index({ priority: -1, 'scheduling.executeAt': 1 });
ScheduledJobSchema.index({ status: 1, 'scheduling.createdAt': 1 });

// Virtual for checking if job is overdue
ScheduledJobSchema.virtual('isOverdue').get(function() {
  return this.status === 'pending' && new Date() > this.scheduling.executeAt;
});

// Virtual for checking if job should be retried
ScheduledJobSchema.virtual('canRetry').get(function() {
  return this.status === 'failed' && 
         this.scheduling.retryCount < this.scheduling.maxRetries;
});

// Method to mark job as started
ScheduledJobSchema.methods.markStarted = function() {
  this.status = 'processing';
  this.scheduling.startedAt = new Date();
  return this.save();
};

// Method to mark job as completed
ScheduledJobSchema.methods.markCompleted = function() {
  this.status = 'completed';
  this.scheduling.completedAt = new Date();
  return this.save();
};

// Method to mark job as failed
ScheduledJobSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.scheduling.retryCount += 1;
  this.error = {
    message: error.message,
    stack: error.stack,
    lastFailedAt: new Date()
  };
  return this.save();
};

// Method to schedule retry
ScheduledJobSchema.methods.scheduleRetry = function(delayMs = 60000) {
  if (this.canRetry) {
    this.status = 'pending';
    this.scheduling.executeAt = new Date(Date.now() + delayMs);
    return this.save();
  }
  throw new Error('Job cannot be retried');
};

// Static method to get pending jobs
ScheduledJobSchema.statics.getPendingJobs = function(limit = 10) {
  return this.find({
    status: 'pending',
    'scheduling.executeAt': { $lte: new Date() }
  })
  .sort({ priority: -1, 'scheduling.executeAt': 1 })
  .limit(limit);
};

// Static method to cleanup old completed jobs
ScheduledJobSchema.statics.cleanupOldJobs = function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    status: { $in: ['completed', 'cancelled'] },
    'scheduling.completedAt': { $lt: cutoffDate }
  });
};

export default mongoose.models.ScheduledJob || mongoose.model('ScheduledJob', ScheduledJobSchema);