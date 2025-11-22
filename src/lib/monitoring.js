/**
 * Monitoring and Health Check System
 * Provides comprehensive monitoring, metrics collection, and health checks
 */

import { connectToDatabase } from './mongodb.js';
import ScheduledJob from '../models/ScheduledJob.js';
import RecurringSeries from '../models/RecurringSeries.js';
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';
import { ERROR_TYPES, ERROR_SEVERITY } from './errorHandling.js';

/**
 * System metrics collector
 */
export class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
    this.collectionInterval = null;
  }

  /**
   * Initialize metrics collection
   */
  initialize() {
    // Collect metrics every 30 seconds
    this.collectionInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        console.error('Error collecting metrics:', error);
      });
    }, 30000);

    console.log('Metrics collection initialized');
  }

  /**
   * Stop metrics collection
   */
  stop() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    console.log('Metrics collection stopped');
  }

  /**
   * Collect system metrics
   */
  async collectMetrics() {
    try {
      await connectToDatabase();
      
      const timestamp = new Date();
      const metrics = {};

      // Job scheduler metrics
      metrics.jobs = await this.collectJobMetrics();
      
      // Recurring series metrics
      metrics.series = await this.collectSeriesMetrics();
      
      // Meeting metrics
      metrics.meetings = await this.collectMeetingMetrics();
      
      // Notification metrics
      metrics.notifications = await this.collectNotificationMetrics();
      
      // System performance metrics
      metrics.system = await this.collectSystemMetrics();

      // Store metrics with timestamp
      this.metrics.set(timestamp.getTime(), metrics);
      
      // Keep only last 24 hours of metrics (2880 data points at 30s intervals)
      this.cleanupOldMetrics(24 * 60 * 60 * 1000);
      
      return metrics;
    } catch (error) {
      console.error('Error collecting metrics:', error);
      throw error;
    }
  }

  /**
   * Collect job scheduler metrics
   */
  async collectJobMetrics() {
    const jobCounts = await ScheduledJob.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const jobsByType = await ScheduledJob.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          processing: {
            $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      }
    ]);

    // Calculate processing lag
    const oldestPendingJob = await ScheduledJob.findOne({
      status: 'pending',
      'scheduling.executeAt': { $lte: new Date() }
    }).sort({ 'scheduling.executeAt': 1 });

    const processingLag = oldestPendingJob ? 
      Date.now() - oldestPendingJob.scheduling.executeAt.getTime() : 0;

    return {
      counts: jobCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byType: jobsByType,
      processingLag,
      oldestPendingJob: oldestPendingJob ? {
        id: oldestPendingJob._id,
        type: oldestPendingJob.type,
        scheduledFor: oldestPendingJob.scheduling.executeAt,
        age: Date.now() - oldestPendingJob.scheduling.executeAt.getTime()
      } : null
    };
  }

  /**
   * Collect recurring series metrics
   */
  async collectSeriesMetrics() {
    const totalSeries = await RecurringSeries.countDocuments();
    const activeSeries = await RecurringSeries.countDocuments({ isActive: true });
    
    const seriesByProvider = await RecurringSeries.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 },
          active: {
            $sum: { $cond: ['$isActive', 1, 0] }
          }
        }
      }
    ]);

    const seriesNeedingGeneration = await RecurringSeries.countDocuments({
      isActive: true,
      nextGenerationDate: { $lte: new Date() }
    });

    return {
      total: totalSeries,
      active: activeSeries,
      inactive: totalSeries - activeSeries,
      byProvider: seriesByProvider,
      needingGeneration: seriesNeedingGeneration
    };
  }

  /**
   * Collect meeting metrics
   */
  async collectMeetingMetrics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const totalMeetings = await Event.countDocuments();
    const recurringMeetings = await Event.countDocuments({ seriesId: { $exists: true } });
    
    const meetingsToday = await Event.countDocuments({
      startTime: { $gte: today, $lt: tomorrow }
    });

    const upcomingMeetings = await Event.countDocuments({
      startTime: { $gte: now }
    });

    const meetingsByProvider = await Event.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 },
          upcoming: {
            $sum: { $cond: [{ $gte: ['$startTime', now] }, 1, 0] }
          }
        }
      }
    ]);

    const cancelledMeetings = await Event.countDocuments({
      $or: [
        { status: 'cancelled' },
        { 'recurrenceInstance.isCancelled': true }
      ]
    });

    return {
      total: totalMeetings,
      recurring: recurringMeetings,
      standalone: totalMeetings - recurringMeetings,
      today: meetingsToday,
      upcoming: upcomingMeetings,
      cancelled: cancelledMeetings,
      byProvider: meetingsByProvider
    };
  }

  /**
   * Collect notification metrics
   */
  async collectNotificationMetrics() {
    const totalNotifications = await Notification.countDocuments();
    
    const notificationsByStatus = await Notification.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const notificationsByType = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          sent: {
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      }
    ]);

    const pendingNotifications = await Notification.countDocuments({
      status: 'scheduled',
      scheduledFor: { $lte: new Date() }
    });

    // Calculate delivery rates
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentNotifications = await Notification.aggregate([
      {
        $match: {
          createdAt: { $gte: last24Hours }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          sent: {
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      }
    ]);

    const deliveryRate = recentNotifications.length > 0 ? 
      (recentNotifications[0].sent / recentNotifications[0].total) * 100 : 0;

    return {
      total: totalNotifications,
      byStatus: notificationsByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byType: notificationsByType,
      pending: pendingNotifications,
      deliveryRate24h: deliveryRate,
      recent24h: recentNotifications[0] || { total: 0, sent: 0, failed: 0 }
    };
  }

  /**
   * Collect system performance metrics
   */
  async collectSystemMetrics() {
    const uptime = Date.now() - this.startTime;
    
    // Memory usage
    const memUsage = process.memoryUsage();
    
    // Database connection status
    let dbStatus = 'disconnected';
    let dbStats = null;
    
    try {
      await connectToDatabase();
      dbStatus = global.mongoose.connection.readyState === 1 ? 'connected' : 'connecting';
      
      // Get database stats
      const db = global.mongoose.connection.db;
      dbStats = await db.stats();
    } catch (error) {
      dbStatus = 'error';
    }

    return {
      uptime,
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      },
      database: {
        status: dbStatus,
        stats: dbStats
      },
      nodeVersion: process.version,
      platform: process.platform
    };
  }

  /**
   * Clean up old metrics data
   */
  cleanupOldMetrics(maxAgeMs) {
    const cutoff = Date.now() - maxAgeMs;
    
    for (const [timestamp] of this.metrics) {
      if (timestamp < cutoff) {
        this.metrics.delete(timestamp);
      }
    }
  }

  /**
   * Get metrics for a time range
   */
  getMetrics(startTime = null, endTime = null) {
    const start = startTime ? new Date(startTime).getTime() : 0;
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    
    const result = [];
    
    for (const [timestamp, metrics] of this.metrics) {
      if (timestamp >= start && timestamp <= end) {
        result.push({
          timestamp: new Date(timestamp),
          ...metrics
        });
      }
    }
    
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics() {
    if (this.metrics.size === 0) {
      return null;
    }
    
    const latestTimestamp = Math.max(...this.metrics.keys());
    return {
      timestamp: new Date(latestTimestamp),
      ...this.metrics.get(latestTimestamp)
    };
  }
}

/**
 * Health check system
 */
export class HealthCheckSystem {
  constructor() {
    this.checks = new Map();
    this.lastResults = new Map();
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      name,
      check: checkFunction,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      interval: options.interval || 60000, // 1 minute default
      lastRun: null,
      enabled: options.enabled !== false
    });
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const results = {};
    const promises = [];

    for (const [name, checkConfig] of this.checks) {
      if (!checkConfig.enabled) {
        continue;
      }

      promises.push(this.runSingleCheck(name, checkConfig));
    }

    const checkResults = await Promise.allSettled(promises);
    
    checkResults.forEach((result, index) => {
      const checkName = Array.from(this.checks.keys())[index];
      
      if (result.status === 'fulfilled') {
        results[checkName] = result.value;
      } else {
        results[checkName] = {
          name: checkName,
          healthy: false,
          error: result.reason.message,
          timestamp: new Date(),
          duration: 0
        };
      }
    });

    // Store results
    this.lastResults.set(Date.now(), results);
    
    // Calculate overall health
    const overallHealth = this.calculateOverallHealth(results);
    
    return {
      overall: overallHealth,
      checks: results,
      timestamp: new Date()
    };
  }

  /**
   * Run a single health check
   */
  async runSingleCheck(name, checkConfig) {
    const startTime = Date.now();
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Health check timeout: ${name}`)), checkConfig.timeout);
      });

      // Run the check with timeout
      const result = await Promise.race([
        checkConfig.check(),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
      checkConfig.lastRun = new Date();

      return {
        name,
        healthy: true,
        result,
        timestamp: new Date(),
        duration,
        critical: checkConfig.critical
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      checkConfig.lastRun = new Date();

      return {
        name,
        healthy: false,
        error: error.message,
        timestamp: new Date(),
        duration,
        critical: checkConfig.critical
      };
    }
  }

  /**
   * Calculate overall system health
   */
  calculateOverallHealth(results) {
    const checks = Object.values(results);
    const totalChecks = checks.length;
    
    if (totalChecks === 0) {
      return { status: 'unknown', score: 0 };
    }

    const healthyChecks = checks.filter(check => check.healthy).length;
    const criticalFailures = checks.filter(check => !check.healthy && check.critical).length;
    
    // If any critical check fails, system is unhealthy
    if (criticalFailures > 0) {
      return {
        status: 'critical',
        score: 0,
        healthyChecks,
        totalChecks,
        criticalFailures
      };
    }

    const healthScore = (healthyChecks / totalChecks) * 100;
    
    let status;
    if (healthScore === 100) {
      status = 'healthy';
    } else if (healthScore >= 80) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      score: healthScore,
      healthyChecks,
      totalChecks,
      criticalFailures: 0
    };
  }

  /**
   * Get health check history
   */
  getHealthHistory(hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const history = [];

    for (const [timestamp, results] of this.lastResults) {
      if (timestamp >= cutoff) {
        history.push({
          timestamp: new Date(timestamp),
          overall: this.calculateOverallHealth(results),
          checks: results
        });
      }
    }

    return history.sort((a, b) => a.timestamp - b.timestamp);
  }
}

/**
 * Alert system for monitoring
 */
export class AlertSystem {
  constructor() {
    this.rules = new Map();
    this.alertHistory = [];
    this.suppressionRules = new Map();
  }

  /**
   * Register an alert rule
   */
  registerAlertRule(name, condition, options = {}) {
    this.rules.set(name, {
      name,
      condition,
      severity: options.severity || 'warning',
      cooldown: options.cooldown || 300000, // 5 minutes default
      message: options.message || `Alert: ${name}`,
      enabled: options.enabled !== false,
      lastTriggered: null
    });
  }

  /**
   * Evaluate alert rules against metrics
   */
  async evaluateAlerts(metrics, healthStatus) {
    const triggeredAlerts = [];

    for (const [name, rule] of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      // Check cooldown
      if (rule.lastTriggered && 
          Date.now() - rule.lastTriggered.getTime() < rule.cooldown) {
        continue;
      }

      try {
        const shouldAlert = await rule.condition(metrics, healthStatus);
        
        if (shouldAlert) {
          const alert = {
            name: rule.name,
            severity: rule.severity,
            message: typeof rule.message === 'function' ? 
                    rule.message(metrics, healthStatus) : rule.message,
            timestamp: new Date(),
            metrics: this.extractRelevantMetrics(metrics, name)
          };

          triggeredAlerts.push(alert);
          rule.lastTriggered = new Date();
          
          // Add to history
          this.alertHistory.push(alert);
          
          // Keep only last 1000 alerts
          if (this.alertHistory.length > 1000) {
            this.alertHistory = this.alertHistory.slice(-1000);
          }
        }
      } catch (error) {
        console.error(`Error evaluating alert rule ${name}:`, error);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Extract relevant metrics for alert context
   */
  extractRelevantMetrics(metrics, alertName) {
    // This could be made more sophisticated to extract only relevant metrics
    // For now, return a summary
    return {
      jobs: metrics.jobs?.counts,
      system: {
        uptime: metrics.system?.uptime,
        memory: metrics.system?.memory?.heapUsed
      },
      notifications: {
        pending: metrics.notifications?.pending,
        deliveryRate: metrics.notifications?.deliveryRate24h
      }
    };
  }

  /**
   * Get alert history
   */
  getAlertHistory(hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    return this.alertHistory.filter(alert => 
      alert.timestamp.getTime() >= cutoff
    ).sort((a, b) => b.timestamp - a.timestamp);
  }
}

// Create singleton instances
export const metricsCollector = new MetricsCollector();
export const healthCheckSystem = new HealthCheckSystem();
export const alertSystem = new AlertSystem();

/**
 * Initialize default health checks
 */
export function initializeDefaultHealthChecks() {
  // Database connectivity check
  healthCheckSystem.registerCheck('database', async () => {
    await connectToDatabase();
    const db = global.mongoose.connection.db;
    await db.admin().ping();
    return { status: 'connected', readyState: global.mongoose.connection.readyState };
  }, { critical: true, timeout: 5000 });

  // Job scheduler health check
  healthCheckSystem.registerCheck('job_scheduler', async () => {
    const pendingJobs = await ScheduledJob.countDocuments({
      status: 'pending',
      'scheduling.executeAt': { $lte: new Date() }
    });
    
    const oldestPendingJob = await ScheduledJob.findOne({
      status: 'pending',
      'scheduling.executeAt': { $lte: new Date() }
    }).sort({ 'scheduling.executeAt': 1 });

    const processingLag = oldestPendingJob ? 
      Date.now() - oldestPendingJob.scheduling.executeAt.getTime() : 0;

    return {
      pendingJobs,
      processingLag,
      healthy: processingLag < 300000 // Less than 5 minutes lag
    };
  }, { critical: true });

  // Memory usage check
  healthCheckSystem.registerCheck('memory', async () => {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    return {
      heapUsedMB: Math.round(heapUsedMB),
      heapTotalMB: Math.round(heapTotalMB),
      usagePercent: Math.round(usagePercent),
      healthy: usagePercent < 90
    };
  });

  // Notification delivery check
  healthCheckSystem.registerCheck('notifications', async () => {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const stats = await Notification.aggregate([
      {
        $match: {
          createdAt: { $gte: last24Hours }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          sent: {
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      }
    ]);

    const deliveryRate = stats.length > 0 ? 
      (stats[0].sent / stats[0].total) * 100 : 100;

    return {
      deliveryRate: Math.round(deliveryRate),
      total24h: stats[0]?.total || 0,
      sent24h: stats[0]?.sent || 0,
      failed24h: stats[0]?.failed || 0,
      healthy: deliveryRate >= 95
    };
  });
}

/**
 * Initialize default alert rules
 */
export function initializeDefaultAlertRules() {
  // High job processing lag
  alertSystem.registerAlertRule('job_processing_lag', (metrics) => {
    return metrics.jobs?.processingLag > 300000; // 5 minutes
  }, {
    severity: 'warning',
    message: (metrics) => `Job processing lag is ${Math.round(metrics.jobs.processingLag / 1000)}s`,
    cooldown: 600000 // 10 minutes
  });

  // High memory usage
  alertSystem.registerAlertRule('high_memory_usage', (metrics) => {
    const memUsage = metrics.system?.memory;
    if (!memUsage) return false;
    
    const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    return usagePercent > 90;
  }, {
    severity: 'warning',
    message: (metrics) => {
      const memUsage = metrics.system.memory;
      const usagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
      return `High memory usage: ${usagePercent}%`;
    }
  });

  // Low notification delivery rate
  alertSystem.registerAlertRule('low_notification_delivery', (metrics) => {
    return metrics.notifications?.deliveryRate24h < 95;
  }, {
    severity: 'critical',
    message: (metrics) => `Low notification delivery rate: ${metrics.notifications.deliveryRate24h}%`
  });

  // System unhealthy
  alertSystem.registerAlertRule('system_unhealthy', (metrics, healthStatus) => {
    return healthStatus.overall?.status === 'critical' || healthStatus.overall?.status === 'unhealthy';
  }, {
    severity: 'critical',
    message: (metrics, healthStatus) => `System health is ${healthStatus.overall.status}`
  });
}

/**
 * Start monitoring system
 */
export async function startMonitoring() {
  try {
    // Initialize health checks and alert rules
    initializeDefaultHealthChecks();
    initializeDefaultAlertRules();
    
    // Start metrics collection
    metricsCollector.initialize();
    
    console.log('Monitoring system started successfully');
    return true;
  } catch (error) {
    console.error('Failed to start monitoring system:', error);
    throw error;
  }
}

/**
 * Stop monitoring system
 */
export function stopMonitoring() {
  metricsCollector.stop();
  console.log('Monitoring system stopped');
}

/**
 * Get comprehensive system status
 */
export async function getSystemStatus() {
  try {
    const [metrics, healthStatus] = await Promise.all([
      metricsCollector.getLatestMetrics(),
      healthCheckSystem.runHealthChecks()
    ]);

    const alerts = await alertSystem.evaluateAlerts(metrics, healthStatus);
    
    return {
      timestamp: new Date(),
      metrics,
      health: healthStatus,
      alerts,
      uptime: Date.now() - metricsCollector.startTime
    };
  } catch (error) {
    console.error('Error getting system status:', error);
    throw error;
  }
}