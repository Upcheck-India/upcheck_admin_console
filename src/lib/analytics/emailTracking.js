/**
 * Advanced Email Tracking and Analytics System
 * Comprehensive tracking for series-level analytics and engagement metrics
 */

import { connectToDatabase } from '../mongodb.js';
import Notification from '../../models/Notification.js';
import Event from '../../models/Event.js';
import RecurringSeries from '../../models/RecurringSeries.js';

/**
 * Email Analytics Model for storing detailed tracking data
 */
const EmailAnalytics = {
  // Track email opens
  async trackOpen(token, userAgent = '', ipAddress = '') {
    try {
      await connectToDatabase();
      
      const notification = await Notification.findOne({ 'tracking.token': token });
      if (!notification) {
        console.log(`Notification not found for token: ${token}`);
        return false;
      }

      // Update notification tracking
      if (!notification.tracking.opened) {
        notification.tracking.opened = true;
        notification.tracking.openedAt = new Date();
        notification.tracking.openCount = 1;
        notification.tracking.userAgent = userAgent;
        notification.tracking.ipAddress = ipAddress;
      } else {
        notification.tracking.openCount = (notification.tracking.openCount || 1) + 1;
        notification.tracking.lastOpenedAt = new Date();
      }

      await notification.save();

      // Record detailed analytics
      await this.recordAnalyticsEvent({
        type: 'email_open',
        notificationId: notification._id,
        meetingId: notification.meetingId,
        seriesId: notification.seriesId,
        recipient: notification.recipient,
        token,
        userAgent,
        ipAddress,
        timestamp: new Date(),
        metadata: {
          notificationType: notification.type,
          timing: notification.timing,
          isFirstOpen: notification.tracking.openCount === 1
        }
      });

      console.log(`Email open tracked for ${notification.recipient} (${notification.type})`);
      return true;

    } catch (error) {
      console.error('Error tracking email open:', error);
      return false;
    }
  },

  // Track email clicks
  async trackClick(token, clickedUrl = '', userAgent = '', ipAddress = '') {
    try {
      await connectToDatabase();
      
      const notification = await Notification.findOne({ 'tracking.token': token });
      if (!notification) {
        console.log(`Notification not found for token: ${token}`);
        return false;
      }

      // Update notification tracking
      if (!notification.tracking.clicked) {
        notification.tracking.clicked = true;
        notification.tracking.clickedAt = new Date();
        notification.tracking.clickCount = 1;
        notification.tracking.clickedUrls = [clickedUrl];
      } else {
        notification.tracking.clickCount = (notification.tracking.clickCount || 1) + 1;
        notification.tracking.lastClickedAt = new Date();
        if (!notification.tracking.clickedUrls.includes(clickedUrl)) {
          notification.tracking.clickedUrls.push(clickedUrl);
        }
      }

      await notification.save();

      // Record detailed analytics
      await this.recordAnalyticsEvent({
        type: 'email_click',
        notificationId: notification._id,
        meetingId: notification.meetingId,
        seriesId: notification.seriesId,
        recipient: notification.recipient,
        token,
        userAgent,
        ipAddress,
        timestamp: new Date(),
        metadata: {
          notificationType: notification.type,
          timing: notification.timing,
          clickedUrl,
          isFirstClick: notification.tracking.clickCount === 1
        }
      });

      console.log(`Email click tracked for ${notification.recipient}: ${clickedUrl}`);
      return true;

    } catch (error) {
      console.error('Error tracking email click:', error);
      return false;
    }
  },

  // Track email acknowledgments
  async trackAcknowledgment(token, userAgent = '', ipAddress = '') {
    try {
      await connectToDatabase();
      
      const notification = await Notification.findOne({ 'tracking.token': token });
      if (!notification) {
        console.log(`Notification not found for token: ${token}`);
        return false;
      }

      // Update notification tracking
      notification.tracking.acknowledged = true;
      notification.tracking.acknowledgedAt = new Date();
      await notification.save();

      // Record detailed analytics
      await this.recordAnalyticsEvent({
        type: 'email_acknowledgment',
        notificationId: notification._id,
        meetingId: notification.meetingId,
        seriesId: notification.seriesId,
        recipient: notification.recipient,
        token,
        userAgent,
        ipAddress,
        timestamp: new Date(),
        metadata: {
          notificationType: notification.type,
          timing: notification.timing
        }
      });

      console.log(`Email acknowledgment tracked for ${notification.recipient}`);
      return true;

    } catch (error) {
      console.error('Error tracking email acknowledgment:', error);
      return false;
    }
  },

  // Track calendar additions
  async trackCalendarAdd(token, calendarType = 'ics', userAgent = '', ipAddress = '') {
    try {
      await connectToDatabase();
      
      const notification = await Notification.findOne({ 'tracking.token': token });
      if (!notification) {
        console.log(`Notification not found for token: ${token}`);
        return false;
      }

      // Update notification tracking
      if (!notification.tracking.calendarAdded) {
        notification.tracking.calendarAdded = true;
        notification.tracking.calendarAddedAt = new Date();
        notification.tracking.calendarType = calendarType;
      }

      await notification.save();

      // Record detailed analytics
      await this.recordAnalyticsEvent({
        type: 'calendar_add',
        notificationId: notification._id,
        meetingId: notification.meetingId,
        seriesId: notification.seriesId,
        recipient: notification.recipient,
        token,
        userAgent,
        ipAddress,
        timestamp: new Date(),
        metadata: {
          notificationType: notification.type,
          calendarType,
          timing: notification.timing
        }
      });

      console.log(`Calendar add tracked for ${notification.recipient}: ${calendarType}`);
      return true;

    } catch (error) {
      console.error('Error tracking calendar add:', error);
      return false;
    }
  },

  // Record detailed analytics event
  async recordAnalyticsEvent(eventData) {
    try {
      // This would typically go to a dedicated analytics collection
      // For now, we'll use a simple logging approach
      console.log('Analytics Event:', JSON.stringify(eventData, null, 2));
      
      // In production, you might want to:
      // 1. Store in a dedicated analytics database
      // 2. Send to external analytics service (Google Analytics, Mixpanel, etc.)
      // 3. Queue for batch processing
      
      return true;
    } catch (error) {
      console.error('Error recording analytics event:', error);
      return false;
    }
  },

  // Get engagement metrics for a meeting
  async getMeetingEngagement(meetingId) {
    try {
      await connectToDatabase();
      
      const notifications = await Notification.find({ meetingId }).lean();
      
      const metrics = {
        totalSent: notifications.length,
        totalOpened: notifications.filter(n => n.tracking?.opened).length,
        totalClicked: notifications.filter(n => n.tracking?.clicked).length,
        totalAcknowledged: notifications.filter(n => n.tracking?.acknowledged).length,
        totalCalendarAdded: notifications.filter(n => n.tracking?.calendarAdded).length,
        openRate: 0,
        clickRate: 0,
        acknowledgmentRate: 0,
        calendarAddRate: 0,
        engagementScore: 0
      };

      if (metrics.totalSent > 0) {
        metrics.openRate = (metrics.totalOpened / metrics.totalSent) * 100;
        metrics.clickRate = (metrics.totalClicked / metrics.totalSent) * 100;
        metrics.acknowledgmentRate = (metrics.totalAcknowledged / metrics.totalSent) * 100;
        metrics.calendarAddRate = (metrics.totalCalendarAdded / metrics.totalSent) * 100;
        
        // Calculate engagement score (weighted average)
        metrics.engagementScore = (
          (metrics.openRate * 0.2) +
          (metrics.clickRate * 0.3) +
          (metrics.acknowledgmentRate * 0.3) +
          (metrics.calendarAddRate * 0.2)
        );
      }

      return metrics;

    } catch (error) {
      console.error('Error getting meeting engagement:', error);
      return null;
    }
  },

  // Get engagement metrics for a recurring series
  async getSeriesEngagement(seriesId) {
    try {
      await connectToDatabase();
      
      const notifications = await Notification.find({ seriesId }).lean();
      const meetings = await Event.find({ seriesId }).lean();
      
      const metrics = {
        totalMeetings: meetings.length,
        totalNotifications: notifications.length,
        seriesNotifications: notifications.filter(n => n.type === 'series_notification').length,
        reminderNotifications: notifications.filter(n => n.type === 'reminder').length,
        
        // Overall engagement
        totalOpened: notifications.filter(n => n.tracking?.opened).length,
        totalClicked: notifications.filter(n => n.tracking?.clicked).length,
        totalAcknowledged: notifications.filter(n => n.tracking?.acknowledged).length,
        totalCalendarAdded: notifications.filter(n => n.tracking?.calendarAdded).length,
        
        // Series notification specific
        seriesOpened: notifications.filter(n => n.type === 'series_notification' && n.tracking?.opened).length,
        seriesClicked: notifications.filter(n => n.type === 'series_notification' && n.tracking?.clicked).length,
        seriesAcknowledged: notifications.filter(n => n.type === 'series_notification' && n.tracking?.acknowledged).length,
        
        // Reminder notification specific
        reminderOpened: notifications.filter(n => n.type === 'reminder' && n.tracking?.opened).length,
        reminderClicked: notifications.filter(n => n.type === 'reminder' && n.tracking?.clicked).length,
        
        // Rates
        overallOpenRate: 0,
        overallClickRate: 0,
        seriesOpenRate: 0,
        seriesClickRate: 0,
        reminderOpenRate: 0,
        reminderClickRate: 0,
        
        // Engagement by meeting
        meetingEngagement: []
      };

      // Calculate overall rates
      if (metrics.totalNotifications > 0) {
        metrics.overallOpenRate = (metrics.totalOpened / metrics.totalNotifications) * 100;
        metrics.overallClickRate = (metrics.totalClicked / metrics.totalNotifications) * 100;
      }

      // Calculate series notification rates
      if (metrics.seriesNotifications > 0) {
        metrics.seriesOpenRate = (metrics.seriesOpened / metrics.seriesNotifications) * 100;
        metrics.seriesClickRate = (metrics.seriesClicked / metrics.seriesNotifications) * 100;
      }

      // Calculate reminder notification rates
      if (metrics.reminderNotifications > 0) {
        metrics.reminderOpenRate = (metrics.reminderOpened / metrics.reminderNotifications) * 100;
        metrics.reminderClickRate = (metrics.reminderClicked / metrics.reminderNotifications) * 100;
      }

      // Get engagement for each meeting
      for (const meeting of meetings) {
        const meetingMetrics = await this.getMeetingEngagement(meeting._id);
        if (meetingMetrics) {
          metrics.meetingEngagement.push({
            meetingId: meeting._id,
            meetingTitle: meeting.effectiveTitle,
            meetingDate: meeting.startTime,
            ...meetingMetrics
          });
        }
      }

      return metrics;

    } catch (error) {
      console.error('Error getting series engagement:', error);
      return null;
    }
  },

  // Get engagement trends over time
  async getEngagementTrends(seriesId, timeframe = '30d') {
    try {
      await connectToDatabase();
      
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      const notifications = await Notification.find({
        seriesId,
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean();

      // Group by day
      const dailyMetrics = {};
      
      notifications.forEach(notification => {
        const day = notification.createdAt.toISOString().split('T')[0];
        
        if (!dailyMetrics[day]) {
          dailyMetrics[day] = {
            date: day,
            sent: 0,
            opened: 0,
            clicked: 0,
            acknowledged: 0
          };
        }
        
        dailyMetrics[day].sent++;
        if (notification.tracking?.opened) dailyMetrics[day].opened++;
        if (notification.tracking?.clicked) dailyMetrics[day].clicked++;
        if (notification.tracking?.acknowledged) dailyMetrics[day].acknowledged++;
      });

      // Convert to array and calculate rates
      const trends = Object.values(dailyMetrics).map(day => ({
        ...day,
        openRate: day.sent > 0 ? (day.opened / day.sent) * 100 : 0,
        clickRate: day.sent > 0 ? (day.clicked / day.sent) * 100 : 0,
        acknowledgmentRate: day.sent > 0 ? (day.acknowledged / day.sent) * 100 : 0
      })).sort((a, b) => new Date(a.date) - new Date(b.date));

      return trends;

    } catch (error) {
      console.error('Error getting engagement trends:', error);
      return [];
    }
  },

  // Get participant engagement summary
  async getParticipantEngagement(seriesId) {
    try {
      await connectToDatabase();
      
      const notifications = await Notification.find({ seriesId }).lean();
      
      const participantMetrics = {};
      
      notifications.forEach(notification => {
        const email = notification.recipient;
        
        if (!participantMetrics[email]) {
          participantMetrics[email] = {
            email,
            totalNotifications: 0,
            opened: 0,
            clicked: 0,
            acknowledged: 0,
            calendarAdded: 0,
            engagementScore: 0
          };
        }
        
        const metrics = participantMetrics[email];
        metrics.totalNotifications++;
        
        if (notification.tracking?.opened) metrics.opened++;
        if (notification.tracking?.clicked) metrics.clicked++;
        if (notification.tracking?.acknowledged) metrics.acknowledged++;
        if (notification.tracking?.calendarAdded) metrics.calendarAdded++;
      });

      // Calculate engagement scores
      Object.values(participantMetrics).forEach(metrics => {
        if (metrics.totalNotifications > 0) {
          const openRate = (metrics.opened / metrics.totalNotifications) * 100;
          const clickRate = (metrics.clicked / metrics.totalNotifications) * 100;
          const ackRate = (metrics.acknowledged / metrics.totalNotifications) * 100;
          const calendarRate = (metrics.calendarAdded / metrics.totalNotifications) * 100;
          
          metrics.engagementScore = (
            (openRate * 0.2) +
            (clickRate * 0.3) +
            (ackRate * 0.3) +
            (calendarRate * 0.2)
          );
        }
      });

      return Object.values(participantMetrics).sort((a, b) => b.engagementScore - a.engagementScore);

    } catch (error) {
      console.error('Error getting participant engagement:', error);
      return [];
    }
  },

  // A/B test email templates
  async createABTest(testConfig) {
    try {
      const {
        name,
        description,
        templateA,
        templateB,
        trafficSplit = 50, // Percentage for template A
        metrics = ['openRate', 'clickRate'],
        duration = 7 // Days
      } = testConfig;

      // This would typically be stored in a dedicated A/B test collection
      const abTest = {
        id: `ab_${Date.now()}`,
        name,
        description,
        templateA,
        templateB,
        trafficSplit,
        metrics,
        duration,
        startDate: new Date(),
        endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
        status: 'active',
        results: {
          templateA: { sent: 0, opened: 0, clicked: 0, acknowledged: 0 },
          templateB: { sent: 0, opened: 0, clicked: 0, acknowledged: 0 }
        }
      };

      console.log('A/B Test Created:', abTest);
      return abTest;

    } catch (error) {
      console.error('Error creating A/B test:', error);
      return null;
    }
  },

  // Get A/B test results
  async getABTestResults(testId) {
    try {
      // This would fetch from the A/B test collection
      // For now, return mock data
      return {
        testId,
        name: 'Series Notification Template Test',
        status: 'completed',
        duration: 7,
        results: {
          templateA: {
            sent: 150,
            opened: 120,
            clicked: 45,
            acknowledged: 30,
            openRate: 80.0,
            clickRate: 30.0,
            acknowledgmentRate: 20.0
          },
          templateB: {
            sent: 150,
            opened: 135,
            clicked: 60,
            acknowledged: 42,
            openRate: 90.0,
            clickRate: 40.0,
            acknowledgmentRate: 28.0
          }
        },
        winner: 'templateB',
        confidence: 95.2,
        improvement: {
          openRate: 12.5,
          clickRate: 33.3,
          acknowledgmentRate: 40.0
        }
      };

    } catch (error) {
      console.error('Error getting A/B test results:', error);
      return null;
    }
  },

  // Monitor email deliverability
  async getDeliverabilityMetrics(seriesId, timeframe = '30d') {
    try {
      await connectToDatabase();
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(timeframe));

      const notifications = await Notification.find({
        seriesId,
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean();

      const metrics = {
        totalSent: notifications.length,
        delivered: notifications.filter(n => n.status === 'sent').length,
        failed: notifications.filter(n => n.status === 'failed').length,
        bounced: notifications.filter(n => n.error?.type === 'bounce').length,
        spam: notifications.filter(n => n.error?.type === 'spam').length,
        
        deliveryRate: 0,
        bounceRate: 0,
        spamRate: 0,
        
        // Bounce analysis
        hardBounces: notifications.filter(n => n.error?.bounceType === 'hard').length,
        softBounces: notifications.filter(n => n.error?.bounceType === 'soft').length,
        
        // Common bounce reasons
        bounceReasons: {}
      };

      if (metrics.totalSent > 0) {
        metrics.deliveryRate = (metrics.delivered / metrics.totalSent) * 100;
        metrics.bounceRate = (metrics.bounced / metrics.totalSent) * 100;
        metrics.spamRate = (metrics.spam / metrics.totalSent) * 100;
      }

      // Analyze bounce reasons
      notifications.forEach(notification => {
        if (notification.error?.bounceReason) {
          const reason = notification.error.bounceReason;
          metrics.bounceReasons[reason] = (metrics.bounceReasons[reason] || 0) + 1;
        }
      });

      return metrics;

    } catch (error) {
      console.error('Error getting deliverability metrics:', error);
      return null;
    }
  }
};

export default EmailAnalytics;