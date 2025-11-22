/**
 * API endpoint for analytics dashboard data
 */

import { NextResponse } from 'next/server';
import EmailAnalytics from '../../../../lib/analytics/emailTracking.js';
import { connectToDatabase } from '../../../../lib/mongodb.js';
import RecurringSeries from '../../../../models/RecurringSeries.js';
import Event from '../../../../models/Event.js';

/**
 * GET /api/analytics/dashboard
 * Get comprehensive analytics dashboard data
 */
export async function GET(request) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('seriesId');
    const meetingId = searchParams.get('meetingId');
    const timeframe = searchParams.get('timeframe') || '30d';
    const type = searchParams.get('type') || 'overview';
    
    let dashboardData = {};
    
    if (seriesId) {
      // Series-level analytics
      dashboardData = await getSeriesDashboard(seriesId, timeframe, type);
    } else if (meetingId) {
      // Meeting-level analytics
      dashboardData = await getMeetingDashboard(meetingId, type);
    } else {
      // Overall system analytics
      dashboardData = await getSystemDashboard(timeframe, type);
    }
    
    return NextResponse.json(dashboardData);
    
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to get dashboard data' },
      { status: 500 }
    );
  }
}

/**
 * Get series-level dashboard data
 */
async function getSeriesDashboard(seriesId, timeframe, type) {
  const series = await RecurringSeries.findById(seriesId);
  if (!series) {
    throw new Error('Series not found');
  }
  
  const engagement = await EmailAnalytics.getSeriesEngagement(seriesId);
  const trends = await EmailAnalytics.getEngagementTrends(seriesId, timeframe);
  const participants = await EmailAnalytics.getParticipantEngagement(seriesId);
  const deliverability = await EmailAnalytics.getDeliverabilityMetrics(seriesId, timeframe);
  
  const dashboard = {
    series: {
      id: series._id,
      title: series.title,
      description: series.description,
      host: series.host,
      participants: series.participants,
      createdAt: series.createdAt,
      recurrencePattern: series.recurrencePattern
    },
    
    overview: {
      totalMeetings: engagement.totalMeetings,
      totalNotifications: engagement.totalNotifications,
      overallEngagement: {
        openRate: engagement.overallOpenRate,
        clickRate: engagement.overallClickRate,
        acknowledgmentRate: (engagement.totalAcknowledged / engagement.totalNotifications) * 100,
        calendarAddRate: (engagement.totalCalendarAdded / engagement.totalNotifications) * 100
      },
      seriesNotificationEngagement: {
        sent: engagement.seriesNotifications,
        openRate: engagement.seriesOpenRate,
        clickRate: engagement.seriesClickRate
      },
      reminderEngagement: {
        sent: engagement.reminderNotifications,
        openRate: engagement.reminderOpenRate,
        clickRate: engagement.reminderClickRate
      }
    },
    
    trends: trends,
    
    participants: participants.map(p => ({
      email: p.email,
      totalNotifications: p.totalNotifications,
      engagementScore: Math.round(p.engagementScore * 10) / 10,
      opened: p.opened,
      clicked: p.clicked,
      acknowledged: p.acknowledged,
      calendarAdded: p.calendarAdded,
      openRate: Math.round((p.opened / p.totalNotifications) * 100 * 10) / 10,
      clickRate: Math.round((p.clicked / p.totalNotifications) * 100 * 10) / 10
    })),
    
    meetingBreakdown: engagement.meetingEngagement.map(m => ({
      meetingId: m.meetingId,
      meetingTitle: m.meetingTitle,
      meetingDate: m.meetingDate,
      totalSent: m.totalSent,
      openRate: Math.round(m.openRate * 10) / 10,
      clickRate: Math.round(m.clickRate * 10) / 10,
      engagementScore: Math.round(m.engagementScore * 10) / 10
    })),
    
    deliverability: {
      deliveryRate: Math.round(deliverability.deliveryRate * 10) / 10,
      bounceRate: Math.round(deliverability.bounceRate * 10) / 10,
      spamRate: Math.round(deliverability.spamRate * 10) / 10,
      totalSent: deliverability.totalSent,
      delivered: deliverability.delivered,
      failed: deliverability.failed,
      bounced: deliverability.bounced,
      hardBounces: deliverability.hardBounces,
      softBounces: deliverability.softBounces,
      bounceReasons: deliverability.bounceReasons
    },
    
    insights: generateSeriesInsights(engagement, trends, participants, deliverability),
    
    recommendations: generateSeriesRecommendations(engagement, trends, participants, deliverability)
  };
  
  return dashboard;
}

/**
 * Get meeting-level dashboard data
 */
async function getMeetingDashboard(meetingId, type) {
  const meeting = await Event.findById(meetingId);
  if (!meeting) {
    throw new Error('Meeting not found');
  }
  
  const engagement = await EmailAnalytics.getMeetingEngagement(meetingId);
  
  const dashboard = {
    meeting: {
      id: meeting._id,
      title: meeting.effectiveTitle,
      description: meeting.effectiveDescription,
      host: meeting.host,
      participants: meeting.effectiveParticipants,
      startTime: meeting.startTime,
      duration: meeting.effectiveDuration,
      provider: meeting.provider,
      seriesId: meeting.seriesId
    },
    
    engagement: {
      totalSent: engagement.totalSent,
      totalOpened: engagement.totalOpened,
      totalClicked: engagement.totalClicked,
      totalAcknowledged: engagement.totalAcknowledged,
      totalCalendarAdded: engagement.totalCalendarAdded,
      openRate: Math.round(engagement.openRate * 10) / 10,
      clickRate: Math.round(engagement.clickRate * 10) / 10,
      acknowledgmentRate: Math.round(engagement.acknowledgmentRate * 10) / 10,
      calendarAddRate: Math.round(engagement.calendarAddRate * 10) / 10,
      engagementScore: Math.round(engagement.engagementScore * 10) / 10
    },
    
    insights: generateMeetingInsights(engagement),
    
    recommendations: generateMeetingRecommendations(engagement)
  };
  
  return dashboard;
}

/**
 * Get system-level dashboard data
 */
async function getSystemDashboard(timeframe, type) {
  // This would aggregate data across all series and meetings
  const dashboard = {
    overview: {
      totalSeries: 0,
      totalMeetings: 0,
      totalNotifications: 0,
      averageEngagement: 0
    },
    
    topPerformingSeries: [],
    
    systemMetrics: {
      deliverabilityRate: 0,
      averageOpenRate: 0,
      averageClickRate: 0
    },
    
    insights: [],
    
    recommendations: []
  };
  
  return dashboard;
}

/**
 * Generate insights for series
 */
function generateSeriesInsights(engagement, trends, participants, deliverability) {
  const insights = [];
  
  // Engagement insights
  if (engagement.overallOpenRate > 80) {
    insights.push({
      type: 'positive',
      category: 'engagement',
      title: 'Excellent Open Rate',
      description: `Your series has an outstanding ${engagement.overallOpenRate.toFixed(1)}% open rate, well above the industry average of 20-25%.`,
      impact: 'high'
    });
  } else if (engagement.overallOpenRate < 20) {
    insights.push({
      type: 'warning',
      category: 'engagement',
      title: 'Low Open Rate',
      description: `Your open rate of ${engagement.overallOpenRate.toFixed(1)}% is below average. Consider improving subject lines or send timing.`,
      impact: 'high'
    });
  }
  
  // Trend insights
  if (trends.length >= 7) {
    const recentTrends = trends.slice(-7);
    const avgRecent = recentTrends.reduce((sum, day) => sum + day.openRate, 0) / recentTrends.length;
    const earlierTrends = trends.slice(0, 7);
    const avgEarlier = earlierTrends.reduce((sum, day) => sum + day.openRate, 0) / earlierTrends.length;
    
    if (avgRecent > avgEarlier * 1.1) {
      insights.push({
        type: 'positive',
        category: 'trends',
        title: 'Improving Engagement',
        description: `Engagement has improved by ${((avgRecent - avgEarlier) / avgEarlier * 100).toFixed(1)}% over the past week.`,
        impact: 'medium'
      });
    } else if (avgRecent < avgEarlier * 0.9) {
      insights.push({
        type: 'warning',
        category: 'trends',
        title: 'Declining Engagement',
        description: `Engagement has declined by ${((avgEarlier - avgRecent) / avgEarlier * 100).toFixed(1)}% over the past week.`,
        impact: 'medium'
      });
    }
  }
  
  // Participant insights
  const highEngagementParticipants = participants.filter(p => p.engagementScore > 70).length;
  const lowEngagementParticipants = participants.filter(p => p.engagementScore < 30).length;
  
  if (highEngagementParticipants > participants.length * 0.7) {
    insights.push({
      type: 'positive',
      category: 'participants',
      title: 'Highly Engaged Audience',
      description: `${highEngagementParticipants} out of ${participants.length} participants show high engagement (70%+ score).`,
      impact: 'medium'
    });
  }
  
  if (lowEngagementParticipants > participants.length * 0.3) {
    insights.push({
      type: 'warning',
      category: 'participants',
      title: 'Low Engagement Participants',
      description: `${lowEngagementParticipants} participants have low engagement scores. Consider personalized follow-up.`,
      impact: 'medium'
    });
  }
  
  // Deliverability insights
  if (deliverability.bounceRate > 5) {
    insights.push({
      type: 'warning',
      category: 'deliverability',
      title: 'High Bounce Rate',
      description: `Bounce rate of ${deliverability.bounceRate.toFixed(1)}% indicates email list quality issues.`,
      impact: 'high'
    });
  }
  
  return insights;
}

/**
 * Generate recommendations for series
 */
function generateSeriesRecommendations(engagement, trends, participants, deliverability) {
  const recommendations = [];
  
  // Engagement recommendations
  if (engagement.overallOpenRate < 25) {
    recommendations.push({
      category: 'engagement',
      title: 'Improve Subject Lines',
      description: 'Test different subject line formats, add urgency indicators, or personalize with recipient names.',
      priority: 'high',
      effort: 'low',
      expectedImpact: '15-25% improvement in open rates'
    });
  }
  
  if (engagement.overallClickRate < 10) {
    recommendations.push({
      category: 'engagement',
      title: 'Enhance Call-to-Action',
      description: 'Make your "Join Meeting" buttons more prominent and add multiple CTAs throughout the email.',
      priority: 'high',
      effort: 'medium',
      expectedImpact: '10-20% improvement in click rates'
    });
  }
  
  // Timing recommendations
  if (trends.length > 0) {
    const bestDay = trends.reduce((best, day) => day.openRate > best.openRate ? day : best);
    recommendations.push({
      category: 'timing',
      title: 'Optimize Send Timing',
      description: `Your best performing day had ${bestDay.openRate.toFixed(1)}% open rate. Consider scheduling more emails around similar times.`,
      priority: 'medium',
      effort: 'low',
      expectedImpact: '5-10% improvement in engagement'
    });
  }
  
  // Personalization recommendations
  const lowEngagementCount = participants.filter(p => p.engagementScore < 30).length;
  if (lowEngagementCount > 0) {
    recommendations.push({
      category: 'personalization',
      title: 'Segment Low-Engagement Users',
      description: `Create targeted campaigns for ${lowEngagementCount} low-engagement participants with different messaging or timing.`,
      priority: 'medium',
      effort: 'high',
      expectedImpact: '20-30% improvement for targeted users'
    });
  }
  
  // Deliverability recommendations
  if (deliverability.bounceRate > 2) {
    recommendations.push({
      category: 'deliverability',
      title: 'Clean Email List',
      description: 'Remove hard bounces and validate email addresses to improve deliverability and sender reputation.',
      priority: 'high',
      effort: 'medium',
      expectedImpact: 'Improved deliverability and engagement rates'
    });
  }
  
  return recommendations;
}

/**
 * Generate insights for individual meetings
 */
function generateMeetingInsights(engagement) {
  const insights = [];
  
  if (engagement.engagementScore > 70) {
    insights.push({
      type: 'positive',
      category: 'performance',
      title: 'High Engagement Meeting',
      description: `This meeting achieved an excellent engagement score of ${engagement.engagementScore.toFixed(1)}%.`,
      impact: 'high'
    });
  } else if (engagement.engagementScore < 30) {
    insights.push({
      type: 'warning',
      category: 'performance',
      title: 'Low Engagement Meeting',
      description: `This meeting had low engagement (${engagement.engagementScore.toFixed(1)}%). Review timing and content.`,
      impact: 'high'
    });
  }
  
  return insights;
}

/**
 * Generate recommendations for individual meetings
 */
function generateMeetingRecommendations(engagement) {
  const recommendations = [];
  
  if (engagement.openRate < 50) {
    recommendations.push({
      category: 'notification',
      title: 'Improve Notification Timing',
      description: 'Consider sending reminders at different intervals or times of day.',
      priority: 'medium',
      effort: 'low'
    });
  }
  
  if (engagement.calendarAddRate < 20) {
    recommendations.push({
      category: 'calendar',
      title: 'Promote Calendar Integration',
      description: 'Make calendar addition more prominent in your email templates.',
      priority: 'medium',
      effort: 'low'
    });
  }
  
  return recommendations;
}