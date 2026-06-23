/**
 * Admin Notification System
 * Handles notifications to administrators for system issues and alerts
 */

import { connectToDatabase } from './mongodb.js';
import { scheduleJob } from './scheduler.js';
import { ERROR_SEVERITY } from './errorHandling.js';

/**
 * Admin notification types
 */
export const NOTIFICATION_TYPES = {
  DEAD_LETTER_QUEUE: 'dead_letter_queue',
  ERROR_THRESHOLD: 'error_threshold_exceeded',
  CRITICAL_ERROR: 'critical_error',
  PROVIDER_FAILURE: 'provider_failure',
  SYSTEM_HEALTH: 'system_health',
  BATCH_GENERATION_SUMMARY: 'batch_generation_summary',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  DATABASE_ISSUE: 'database_issue'
};

/**
 * Admin notification channels
 */
export const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  SLACK: 'slack',
  WEBHOOK: 'webhook',
  DATABASE: 'database'
};

/**
 * Admin notification manager
 */
export class AdminNotificationManager {
  constructor() {
    this.channels = new Map();
    this.templates = new Map();
    this.suppressionRules = new Map();
    this.notificationHistory = [];
    
    // Initialize default templates
    this.initializeDefaultTemplates();
  }

  /**
   * Register a notification channel
   */
  registerChannel(name, handler, options = {}) {
    this.channels.set(name, {
      name,
      handler,
      enabled: options.enabled !== false,
      priority: options.priority || 0,
      timeout: options.timeout || 10000
    });
  }

  /**
   * Register a notification template
   */
  registerTemplate(type, template) {
    this.templates.set(type, template);
  }

  /**
   * Send admin notification
   */
  async sendNotification(type, data, options = {}) {
    try {
      const {
        severity = ERROR_SEVERITY.MEDIUM,
        channels = [NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.DATABASE],
        immediate = false,
        suppressionKey = null
      } = options;

      // Check suppression rules
      if (suppressionKey && this.isSuppressed(suppressionKey)) {
        console.log(`Notification suppressed: ${suppressionKey}`);
        return;
      }

      // Get template
      const template = this.templates.get(type);
      if (!template) {
        console.error(`No template found for notification type: ${type}`);
        return;
      }

      // Generate notification content
      const notification = {
        id: this.generateNotificationId(),
        type,
        severity,
        timestamp: new Date(),
        data,
        content: template(data),
        channels: channels.filter(channel => this.channels.has(channel))
      };

      // Add to history
      this.notificationHistory.push(notification);
      
      // Keep only last 1000 notifications
      if (this.notificationHistory.length > 1000) {
        this.notificationHistory = this.notificationHistory.slice(-1000);
      }

      // Send through each channel
      const results = await Promise.allSettled(
        notification.channels.map(channelName => 
          this.sendThroughChannel(channelName, notification)
        )
      );

      // Log results
      results.forEach((result, index) => {
        const channelName = notification.channels[index];
        if (result.status === 'rejected') {
          console.error(`Failed to send notification through ${channelName}:`, result.reason);
        }
      });

      // Apply suppression if specified
      if (suppressionKey) {
        this.applySuppression(suppressionKey, severity);
      }

      console.log(`Admin notification sent: ${type} (${severity})`);
      return notification;

    } catch (error) {
      console.error('Error sending admin notification:', error);
      throw error;
    }
  }

  /**
   * Send notification through specific channel
   */
  async sendThroughChannel(channelName, notification) {
    const channel = this.channels.get(channelName);
    if (!channel || !channel.enabled) {
      return;
    }

    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Channel timeout: ${channelName}`)), channel.timeout);
      });

      // Send with timeout
      await Promise.race([
        channel.handler(notification),
        timeoutPromise
      ]);

    } catch (error) {
      console.error(`Error sending through channel ${channelName}:`, error);
      throw error;
    }
  }

  /**
   * Check if notification is suppressed
   */
  isSuppressed(suppressionKey) {
    const rule = this.suppressionRules.get(suppressionKey);
    if (!rule) {
      return false;
    }

    return Date.now() < rule.suppressUntil;
  }

  /**
   * Apply suppression rule
   */
  applySuppression(suppressionKey, severity) {
    // Suppression duration based on severity
    const suppressionDuration = {
      [ERROR_SEVERITY.LOW]: 30 * 60 * 1000, // 30 minutes
      [ERROR_SEVERITY.MEDIUM]: 15 * 60 * 1000, // 15 minutes
      [ERROR_SEVERITY.HIGH]: 10 * 60 * 1000, // 10 minutes
      [ERROR_SEVERITY.CRITICAL]: 5 * 60 * 1000 // 5 minutes
    };

    const duration = suppressionDuration[severity] || suppressionDuration[ERROR_SEVERITY.MEDIUM];
    
    this.suppressionRules.set(suppressionKey, {
      suppressUntil: Date.now() + duration,
      severity,
      createdAt: new Date()
    });
  }

  /**
   * Generate unique notification ID
   */
  generateNotificationId() {
    return `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get notification history
   */
  getNotificationHistory(hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    return this.notificationHistory.filter(notification => 
      notification.timestamp.getTime() >= cutoff
    ).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Initialize default notification templates
   */
  initializeDefaultTemplates() {
    // Dead letter queue notification
    this.registerTemplate(NOTIFICATION_TYPES.DEAD_LETTER_QUEUE, (data) => ({
      subject: `🚨 Job Failed Permanently: ${data.jobType}`,
      text: `A job has been moved to the dead letter queue after ${data.retryCount} failed attempts.

Job Details:
- Type: ${data.jobType}
- Job ID: ${data.dlqEntryId}
- Error: ${data.error}
- Failed At: ${new Date().toLocaleString()}

Please review the dead letter queue in the admin dashboard.`,
      
      html: `
        <h2>🚨 Job Failed Permanently</h2>
        <p>A job has been moved to the dead letter queue after multiple failed attempts.</p>
        
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Job Type:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.jobType}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Job ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.dlqEntryId}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Retry Count:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.retryCount}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Error:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.error}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Failed At:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td></tr>
        </table>
        
        <p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin/dead-letter-queue" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Dead Letter Queue</a></p>
      `
    }));

    // Error threshold exceeded
    this.registerTemplate(NOTIFICATION_TYPES.ERROR_THRESHOLD, (data) => ({
      subject: `⚠️ Error Threshold Exceeded: ${data.errorType}`,
      text: `Error threshold has been exceeded for ${data.errorType}.

Details:
- Error Type: ${data.errorType}
- Error Count: ${data.errorCount}
- Time Window: ${Math.round(data.timeWindow / 60000)} minutes
- Severity: ${data.severity}

Recent errors:
${data.errors.map(e => `- ${e.message} (${new Date(e.timestamp).toLocaleString()})`).join('\n')}`,
      
      html: `
        <h2>⚠️ Error Threshold Exceeded</h2>
        <p>Error threshold has been exceeded for <strong>${data.errorType}</strong>.</p>
        
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Error Type:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.errorType}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Error Count:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.errorCount}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Time Window:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${Math.round(data.timeWindow / 60000)} minutes</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Severity:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.severity}</td></tr>
        </table>
        
        <h3>Recent Errors:</h3>
        <ul>
          ${data.errors.map(e => `<li>${e.message} <em>(${new Date(e.timestamp).toLocaleString()})</em></li>`).join('')}
        </ul>
      `
    }));

    // Critical error notification
    this.registerTemplate(NOTIFICATION_TYPES.CRITICAL_ERROR, (data) => ({
      subject: `🚨 CRITICAL ERROR: ${data.error.type}`,
      text: `A critical error has occurred in the recurring meetings system.

Error Details:
- Type: ${data.error.type}
- Message: ${data.error.message}
- Severity: ${data.error.severity}
- Timestamp: ${new Date(data.error.timestamp).toLocaleString()}
- Context: ${JSON.stringify(data.context, null, 2)}

Immediate attention required!`,
      
      html: `
        <h2 style="color: #dc3545;">🚨 CRITICAL ERROR</h2>
        <p>A critical error has occurred in the recurring meetings system.</p>
        
        <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 15px 0;">
          <h3 style="margin-top: 0;">Error Details</h3>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Type:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.error.type}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Message:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.error.message}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Severity:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.error.severity}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Timestamp:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date(data.error.timestamp).toLocaleString()}</td></tr>
          </table>
        </div>
        
        <p><strong>⚠️ Immediate attention required!</strong></p>
      `
    }));

    // Provider failure notification
    this.registerTemplate(NOTIFICATION_TYPES.PROVIDER_FAILURE, (data) => ({
      subject: `🔌 Provider Issue: ${data.provider}`,
      text: `There's an issue with the ${data.provider} provider.

Details:
- Provider: ${data.provider}
- Issue Type: ${data.type}
- Series ID: ${data.seriesId || 'N/A'}
- Meeting ID: ${data.meetingId || 'N/A'}
- Error: ${data.error}
- Scheduled For: ${data.scheduledFor ? new Date(data.scheduledFor).toLocaleString() : 'N/A'}

${data.fallbackCreated ? 'A fallback meeting has been created.' : 'No fallback was possible.'}`,
      
      html: `
        <h2>🔌 Provider Issue: ${data.provider}</h2>
        <p>There's an issue with the <strong>${data.provider}</strong> provider.</p>
        
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Provider:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.provider}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Issue Type:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.type}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Error:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.error}</td></tr>
          ${data.seriesId ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Series ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.seriesId}</td></tr>` : ''}
          ${data.scheduledFor ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Scheduled For:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date(data.scheduledFor).toLocaleString()}</td></tr>` : ''}
        </table>
        
        ${data.fallbackCreated ? 
          '<div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; border-radius: 4px; margin: 10px 0;">✅ A fallback meeting has been created.</div>' : 
          '<div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 4px; margin: 10px 0;">❌ No fallback was possible.</div>'
        }
      `
    }));

    // System health notification
    this.registerTemplate(NOTIFICATION_TYPES.SYSTEM_HEALTH, (data) => ({
      subject: `🏥 System Health Alert: ${data.status}`,
      text: `System health status has changed to: ${data.status}

Health Score: ${data.score}%
Healthy Checks: ${data.healthyChecks}/${data.totalChecks}
Critical Failures: ${data.criticalFailures}

Failed Checks:
${data.failedChecks.map(check => `- ${check.name}: ${check.error}`).join('\n')}`,
      
      html: `
        <h2>🏥 System Health Alert</h2>
        <p>System health status has changed to: <strong style="color: ${data.status === 'critical' ? '#dc3545' : '#ffc107'}">${data.status}</strong></p>
        
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Health Score:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.score}%</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Healthy Checks:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.healthyChecks}/${data.totalChecks}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Critical Failures:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.criticalFailures}</td></tr>
        </table>
        
        ${data.failedChecks.length > 0 ? `
          <h3>Failed Checks:</h3>
          <ul>
            ${data.failedChecks.map(check => `<li><strong>${check.name}:</strong> ${check.error}</li>`).join('')}
          </ul>
        ` : ''}
      `
    }));
  }
}

/**
 * Email notification channel
 */
export async function emailNotificationHandler(notification) {
  try {
    const { sendAdminEmail } = await import('./emailService.js');
    
    await sendAdminEmail({
      subject: notification.content.subject,
      text: notification.content.text,
      html: notification.content.html,
      type: 'system_alert'
    });
    
    console.log(`Admin notification email sent`);

  } catch (error) {
    console.error('Error sending admin notification email:', error);
    throw error;
  }
}

/**
 * Database notification channel (for admin dashboard)
 */
export async function databaseNotificationHandler(notification) {
  try {
    const connection = await connectToDatabase();
    const db = connection.db || global.mongoose?.connection?.db || connection.useDb('resources').db;
    
    const dbNotification = {
      ...notification,
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
      createdAt: new Date()
    };

    await db.collection('admin_notifications').insertOne(dbNotification);
    console.log(`Admin notification stored in database: ${notification.id}`);

  } catch (error) {
    console.error('Error storing admin notification in database:', error);
    throw error;
  }
}

/**
 * Slack notification channel (if configured)
 */
export async function slackNotificationHandler(notification) {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn('Slack webhook URL not configured');
      return;
    }

    const color = {
      [ERROR_SEVERITY.LOW]: '#36a64f',
      [ERROR_SEVERITY.MEDIUM]: '#ffaa00',
      [ERROR_SEVERITY.HIGH]: '#ff6600',
      [ERROR_SEVERITY.CRITICAL]: '#ff0000'
    }[notification.severity] || '#ffaa00';

    const payload = {
      text: notification.content.subject,
      attachments: [{
        color,
        title: notification.content.subject,
        text: notification.content.text,
        footer: 'Upcheck Admin',
        ts: Math.floor(notification.timestamp.getTime() / 1000)
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    console.log('Admin notification sent to Slack');

  } catch (error) {
    console.error('Error sending admin notification to Slack:', error);
    throw error;
  }
}

// Create singleton instance
export const adminNotificationManager = new AdminNotificationManager();

/**
 * Initialize admin notification system
 */
export function initializeAdminNotifications() {
  // Register notification channels
  adminNotificationManager.registerChannel(
    NOTIFICATION_CHANNELS.EMAIL, 
    emailNotificationHandler,
    { enabled: true, priority: 1 }
  );

  adminNotificationManager.registerChannel(
    NOTIFICATION_CHANNELS.DATABASE, 
    databaseNotificationHandler,
    { enabled: true, priority: 0 }
  );

  adminNotificationManager.registerChannel(
    NOTIFICATION_CHANNELS.SLACK, 
    slackNotificationHandler,
    { enabled: !!process.env.SLACK_WEBHOOK_URL, priority: 2 }
  );

  console.log('Admin notification system initialized');
}

/**
 * Send admin notification (convenience function)
 */
export async function sendAdminNotification(type, data, options = {}) {
  return adminNotificationManager.sendNotification(type, data, options);
}

/**
 * Get admin notification history
 */
export function getAdminNotificationHistory(hours = 24) {
  return adminNotificationManager.getNotificationHistory(hours);
}