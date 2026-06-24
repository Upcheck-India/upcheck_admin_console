/**
 * Comprehensive Error Handling and Retry Mechanisms
 * Provides exponential backoff, dead letter queue, and error notification system
 */

import { connectToDatabase } from './mongodb.js';
import { scheduleJob } from './scheduler.js';

/**
 * Error types and classifications
 */
export const ERROR_TYPES = {
  PROVIDER_API: 'provider_api',
  DATABASE: 'database',
  EMAIL_DELIVERY: 'email_delivery',
  VALIDATION: 'validation',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  AUTHENTICATION: 'authentication',
  SYSTEM: 'system'
};

export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Retry configuration for different operation types
 */
export const RETRY_CONFIG = {
  zoom_api: { 
    maxRetries: 3, 
    backoffMs: [1000, 5000, 15000],
    jitter: true,
    maxBackoffMs: 30000
  },
  google_meet_api: { 
    maxRetries: 3, 
    backoffMs: [2000, 8000, 20000],
    jitter: true,
    maxBackoffMs: 45000
  },
  email_send: { 
    maxRetries: 5, 
    backoffMs: [2000, 10000, 30000, 60000, 300000],
    jitter: true,
    maxBackoffMs: 600000
  },
  database_operation: { 
    maxRetries: 3, 
    backoffMs: [500, 2000, 8000],
    jitter: false,
    maxBackoffMs: 10000
  },
  job_processing: { 
    maxRetries: 3, 
    backoffMs: [5000, 30000, 120000],
    jitter: true,
    maxBackoffMs: 300000
  },
  notification_send: { 
    maxRetries: 4, 
    backoffMs: [1000, 5000, 20000, 60000],
    jitter: true,
    maxBackoffMs: 120000
  }
};

/**
 * Enhanced Error class with additional context
 */
export class RecurringMeetingError extends Error {
  constructor(message, type = ERROR_TYPES.SYSTEM, severity = ERROR_SEVERITY.MEDIUM, context = {}) {
    super(message);
    this.name = 'RecurringMeetingError';
    this.type = type;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date();
    this.retryable = this.determineRetryability();
    this.isCritical = severity === ERROR_SEVERITY.CRITICAL;
  }

  determineRetryability() {
    // Non-retryable error types
    const nonRetryableTypes = [
      ERROR_TYPES.VALIDATION,
      ERROR_TYPES.AUTHENTICATION
    ];

    if (nonRetryableTypes.includes(this.type)) {
      return false;
    }

    // Check for specific error patterns that shouldn't be retried
    const nonRetryablePatterns = [
      /invalid.*credentials/i,
      /unauthorized/i,
      /forbidden/i,
      /not.*found/i,
      /invalid.*request/i
    ];

    return !nonRetryablePatterns.some(pattern => pattern.test(this.message));
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      retryable: this.retryable,
      isCritical: this.isCritical,
      stack: this.stack
    };
  }
}

/**
 * Exponential backoff with jitter implementation
 */
export function calculateBackoff(attempt, config) {
  const { backoffMs, jitter = true, maxBackoffMs = 300000 } = config;
  
  // Get base delay from config or calculate exponential
  let delay;
  if (backoffMs && backoffMs[attempt]) {
    delay = backoffMs[attempt];
  } else {
    // Fallback to exponential backoff: 1000 * 2^attempt
    delay = Math.min(1000 * Math.pow(2, attempt), maxBackoffMs);
  }

  // Add jitter to prevent thundering herd
  if (jitter) {
    const jitterAmount = delay * 0.1; // 10% jitter
    delay += (Math.random() - 0.5) * 2 * jitterAmount;
  }

  return Math.min(Math.max(delay, 100), maxBackoffMs); // Min 100ms, max as configured
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry(operation, operationType, context = {}) {
  const config = RETRY_CONFIG[operationType] || RETRY_CONFIG.job_processing;
  let lastError;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Log successful retry if this wasn't the first attempt
      if (attempt > 0) {
        console.log(`Operation succeeded on attempt ${attempt + 1}/${config.maxRetries + 1}`, {
          operationType,
          context,
          attempt
        });
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Convert to our error type if needed
      if (!(error instanceof RecurringMeetingError)) {
        lastError = new RecurringMeetingError(
          error.message,
          classifyError(error),
          ERROR_SEVERITY.MEDIUM,
          { originalError: error, ...context }
        );
      }

      // Don't retry if error is not retryable
      if (!lastError.retryable) {
        console.error(`Non-retryable error in ${operationType}:`, lastError.toJSON());
        throw lastError;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= config.maxRetries) {
        console.error(`Operation failed after ${config.maxRetries + 1} attempts:`, {
          operationType,
          context,
          error: lastError.toJSON()
        });
        break;
      }

      // Calculate delay and wait
      const delay = calculateBackoff(attempt, config);
      console.warn(`Attempt ${attempt + 1}/${config.maxRetries + 1} failed, retrying in ${delay}ms:`, {
        operationType,
        context,
        error: lastError.message,
        attempt: attempt + 1
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Classify errors based on message and type
 */
export function classifyError(error) {
  const message = error.message?.toLowerCase() || '';
  
  // Provider API errors
  if (error.isZoomError || message.includes('zoom')) {
    return ERROR_TYPES.PROVIDER_API;
  }
  if (error.isGoogleMeetError || message.includes('google meet')) {
    return ERROR_TYPES.PROVIDER_API;
  }
  
  // Database errors
  if (message.includes('mongo') || message.includes('database') || message.includes('connection')) {
    return ERROR_TYPES.DATABASE;
  }
  
  // Network errors
  if (message.includes('network') || message.includes('timeout') || message.includes('econnreset')) {
    return ERROR_TYPES.NETWORK;
  }
  
  // Rate limiting
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return ERROR_TYPES.RATE_LIMIT;
  }
  
  // Authentication
  if (message.includes('unauthorized') || message.includes('authentication') || message.includes('credentials')) {
    return ERROR_TYPES.AUTHENTICATION;
  }
  
  // Email delivery
  if (message.includes('email') || message.includes('smtp') || message.includes('mail')) {
    return ERROR_TYPES.EMAIL_DELIVERY;
  }
  
  // Validation
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return ERROR_TYPES.VALIDATION;
  }
  
  return ERROR_TYPES.SYSTEM;
}

/**
 * Dead Letter Queue implementation
 */
export class DeadLetterQueue {
  constructor() {
    this.collectionName = 'dead_letter_queue';
  }

  async moveToDeadLetterQueue(job, error, context = {}) {
    try {
      const connection = await connectToDatabase();
      const db = connection.db || connection.useDb('resources').db;
      
      const dlqEntry = {
        originalJobId: job._id,
        jobType: job.type,
        payload: job.payload,
        error: error instanceof RecurringMeetingError ? error.toJSON() : {
          message: error.message,
          stack: error.stack,
          type: classifyError(error)
        },
        context,
        failedAt: new Date(),
        retryCount: job.scheduling?.retryCount || 0,
        createdAt: job.scheduling?.createdAt || new Date(),
        lastAttemptAt: new Date(),
        status: 'dead_letter',
        adminNotified: false,
        resolved: false
      };

      await db.collection(this.collectionName).insertOne(dlqEntry);
      
      console.error(`Moved job ${job._id} to dead letter queue:`, {
        jobType: job.type,
        error: error.message,
        retryCount: dlqEntry.retryCount
      });

      // Schedule admin notification
      await this.scheduleAdminNotification(dlqEntry);
      
      return dlqEntry;
    } catch (dlqError) {
      console.error('Failed to move job to dead letter queue:', dlqError);
      throw dlqError;
    }
  }

  async scheduleAdminNotification(dlqEntry) {
    try {
      // Schedule immediate admin notification for critical errors
      const isCritical = dlqEntry.error.severity === ERROR_SEVERITY.CRITICAL ||
                        dlqEntry.error.type === ERROR_TYPES.PROVIDER_API;

      await scheduleJob('send_admin_notification', {
        type: 'dead_letter_queue',
        dlqEntryId: dlqEntry._id,
        severity: isCritical ? 'critical' : 'warning',
        jobType: dlqEntry.jobType,
        error: dlqEntry.error.message,
        context: dlqEntry.context
      }, new Date());

      console.log(`Scheduled admin notification for dead letter queue entry ${dlqEntry._id}`);
    } catch (error) {
      console.error('Failed to schedule admin notification:', error);
    }
  }

  async getDeadLetterEntries(filters = {}) {
    try {
      const connection = await connectToDatabase();
      const db = connection.db || connection.useDb('resources').db;
      
      const query = { status: 'dead_letter', ...filters };
      const entries = await db.collection(this.collectionName)
        .find(query)
        .sort({ failedAt: -1 })
        .limit(100)
        .toArray();

      return entries;
    } catch (error) {
      console.error('Error getting dead letter entries:', error);
      throw error;
    }
  }

  async retryDeadLetterEntry(entryId) {
    try {
      const connection = await connectToDatabase();
      const db = connection.db || connection.useDb('resources').db;
      
      const entry = await db.collection(this.collectionName).findOne({ _id: entryId });
      if (!entry) {
        throw new Error(`Dead letter entry ${entryId} not found`);
      }

      // Reschedule the original job
      await scheduleJob(entry.jobType, entry.payload, new Date());
      
      // Mark entry as retried
      await db.collection(this.collectionName).updateOne(
        { _id: entryId },
        { 
          $set: { 
            status: 'retried',
            retriedAt: new Date()
          }
        }
      );

      console.log(`Retried dead letter entry ${entryId}`);
      return true;
    } catch (error) {
      console.error(`Error retrying dead letter entry ${entryId}:`, error);
      throw error;
    }
  }

  async resolveDeadLetterEntry(entryId, resolution = '') {
    try {
      const connection = await connectToDatabase();
      const db = connection.db || connection.useDb('resources').db;
      
      await db.collection(this.collectionName).updateOne(
        { _id: entryId },
        { 
          $set: { 
            status: 'resolved',
            resolved: true,
            resolvedAt: new Date(),
            resolution
          }
        }
      );

      console.log(`Resolved dead letter entry ${entryId}: ${resolution}`);
      return true;
    } catch (error) {
      console.error(`Error resolving dead letter entry ${entryId}:`, error);
      throw error;
    }
  }
}

/**
 * Error notification system for administrators
 */
export class ErrorNotificationSystem {
  constructor() {
    this.notificationThresholds = {
      [ERROR_TYPES.PROVIDER_API]: { count: 3, timeWindowMs: 300000 }, // 3 in 5 minutes
      [ERROR_TYPES.DATABASE]: { count: 5, timeWindowMs: 600000 }, // 5 in 10 minutes
      [ERROR_TYPES.EMAIL_DELIVERY]: { count: 10, timeWindowMs: 900000 }, // 10 in 15 minutes
      [ERROR_TYPES.RATE_LIMIT]: { count: 1, timeWindowMs: 60000 }, // 1 in 1 minute
      [ERROR_TYPES.SYSTEM]: { count: 5, timeWindowMs: 300000 } // 5 in 5 minutes
    };
    
    this.errorCounts = new Map();
  }

  async recordError(error, context = {}) {
    try {
      const errorType = error.type || classifyError(error);
      const now = Date.now();
      
      // Initialize error tracking for this type
      if (!this.errorCounts.has(errorType)) {
        this.errorCounts.set(errorType, []);
      }
      
      const errors = this.errorCounts.get(errorType);
      
      // Add current error
      errors.push({
        timestamp: now,
        message: error.message,
        severity: error.severity || ERROR_SEVERITY.MEDIUM,
        context
      });
      
      // Clean up old errors outside time window
      const threshold = this.notificationThresholds[errorType] || 
                       this.notificationThresholds[ERROR_TYPES.SYSTEM];
      
      const cutoff = now - threshold.timeWindowMs;
      const recentErrors = errors.filter(e => e.timestamp > cutoff);
      this.errorCounts.set(errorType, recentErrors);
      
      // Check if we should send notification
      if (recentErrors.length >= threshold.count) {
        await this.sendErrorNotification(errorType, recentErrors, context);
        
        // Reset counter after notification
        this.errorCounts.set(errorType, []);
      }
      
      // Always log critical errors immediately
      if (error.severity === ERROR_SEVERITY.CRITICAL) {
        await this.sendCriticalErrorNotification(error, context);
      }
      
    } catch (notificationError) {
      console.error('Error recording error for notification:', notificationError);
    }
  }

  async sendErrorNotification(errorType, errors, context = {}) {
    try {
      const severity = errors.some(e => e.severity === ERROR_SEVERITY.CRITICAL) ? 
                      'critical' : 'warning';
      
      await scheduleJob('send_admin_notification', {
        type: 'error_threshold_exceeded',
        errorType,
        errorCount: errors.length,
        timeWindow: this.notificationThresholds[errorType].timeWindowMs,
        severity,
        errors: errors.slice(-5), // Last 5 errors
        context
      }, new Date());

      console.warn(`Scheduled admin notification for ${errorType} errors:`, {
        count: errors.length,
        severity
      });
    } catch (error) {
      console.error('Failed to send error notification:', error);
    }
  }

  async sendCriticalErrorNotification(error, context = {}) {
    try {
      await scheduleJob('send_admin_notification', {
        type: 'critical_error',
        error: error instanceof RecurringMeetingError ? error.toJSON() : {
          message: error.message,
          stack: error.stack,
          type: classifyError(error)
        },
        severity: 'critical',
        context,
        immediate: true
      }, new Date());

      console.error('Scheduled immediate critical error notification:', error.message);
    } catch (notificationError) {
      console.error('Failed to send critical error notification:', notificationError);
    }
  }

  getErrorStats() {
    const stats = {};
    
    for (const [errorType, errors] of this.errorCounts.entries()) {
      stats[errorType] = {
        count: errors.length,
        lastError: errors.length > 0 ? errors[errors.length - 1] : null,
        threshold: this.notificationThresholds[errorType]
      };
    }
    
    return stats;
  }
}

/**
 * Graceful failure handling for partial operations
 */
export class PartialFailureHandler {
  constructor() {
    this.results = {
      successful: [],
      failed: [],
      partiallySuccessful: []
    };
  }

  async executeWithPartialFailure(operations, options = {}) {
    const {
      continueOnFailure = true,
      maxFailures = null,
      onProgress = null,
      onFailure = null
    } = options;

    let failureCount = 0;

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      
      try {
        const result = await operation.execute();
        
        this.results.successful.push({
          index: i,
          operation: operation.name || `Operation ${i}`,
          result,
          executedAt: new Date()
        });

        if (onProgress) {
          onProgress({
            completed: i + 1,
            total: operations.length,
            successful: this.results.successful.length,
            failed: this.results.failed.length
          });
        }

      } catch (error) {
        failureCount++;
        
        const failureInfo = {
          index: i,
          operation: operation.name || `Operation ${i}`,
          error: error instanceof RecurringMeetingError ? error : 
                 new RecurringMeetingError(error.message, classifyError(error)),
          failedAt: new Date()
        };

        this.results.failed.push(failureInfo);

        if (onFailure) {
          onFailure(failureInfo);
        }

        // Check if we should stop processing
        if (!continueOnFailure || (maxFailures && failureCount >= maxFailures)) {
          console.warn(`Stopping execution after ${failureCount} failures`);
          break;
        }
      }
    }

    return {
      ...this.results,
      summary: {
        total: operations.length,
        successful: this.results.successful.length,
        failed: this.results.failed.length,
        successRate: (this.results.successful.length / operations.length) * 100
      }
    };
  }
}

// Create singleton instances
export const deadLetterQueue = new DeadLetterQueue();
export const errorNotificationSystem = new ErrorNotificationSystem();

// Export utility functions
export const recordError = (error, context) => errorNotificationSystem.recordError(error, context);
export const moveToDeadLetterQueue = (job, error, context) => deadLetterQueue.moveToDeadLetterQueue(job, error, context);