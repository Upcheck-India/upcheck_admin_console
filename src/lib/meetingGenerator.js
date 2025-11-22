import Event from '../models/Event.js';
import RecurringSeries from '../models/RecurringSeries.js';
import { generateOccurrences } from './recurrence.js';
import { createZoomMeeting, createZoomMeetingForRecurring } from './zoom.js';
import { createGoogleMeetForRecurring, scheduleGoogleMeetBot } from './googleMeet.js';
import { selectOptimalProvider, getOptimalBatchConfig, validateProviderSettings } from './providerManager.js';
import { connectToDatabase } from './mongodb.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Meeting Generator Service
 * Handles creation of meeting instances from recurring series
 */

/**
 * Generate meeting instances for a recurring series
 */
export async function generateMeetingInstances(seriesId, fromDate = new Date(), toDate = null) {
  try {
    await connectToDatabase();
    
    const series = await RecurringSeries.findById(seriesId);
    if (!series) {
      throw new Error(`Recurring series ${seriesId} not found`);
    }

    if (!series.isActive) {
      console.log(`Series ${seriesId} is inactive, skipping generation`);
      return [];
    }

    // Calculate how far ahead to generate meetings (default: 3 months)
    if (!toDate) {
      toDate = new Date();
      toDate.setMonth(toDate.getMonth() + 3);
    }

    // Check if series has expired
    if (series.isExpired) {
      console.log(`Series ${seriesId} has expired, marking as inactive`);
      series.isActive = false;
      await series.save();
      return [];
    }

    // Generate occurrence dates
    const occurrences = generateOccurrences(
      series.recurrencePattern,
      fromDate,
      toDate
    );

    if (occurrences.length === 0) {
      console.log(`No occurrences to generate for series ${seriesId}`);
      return [];
    }

    console.log(`Generating ${occurrences.length} meeting instances for series ${seriesId}`);

    // Check for existing meetings to avoid duplicates
    const existingMeetings = await Event.find({
      seriesId: seriesId,
      startTime: { 
        $gte: fromDate,
        $lte: toDate
      }
    }).select('startTime').lean();

    const existingTimes = new Set(
      existingMeetings.map(m => m.startTime.getTime())
    );

    // Filter out occurrences that already have meetings
    const newOccurrences = occurrences.filter(
      occurrence => !existingTimes.has(occurrence.getTime())
    );

    if (newOccurrences.length === 0) {
      console.log(`All occurrences already exist for series ${seriesId}`);
      return [];
    }

    console.log(`Creating ${newOccurrences.length} new meeting instances`);

    // Create meeting instances in batches to avoid overwhelming the system
    const batchSize = 10;
    const createdMeetings = [];

    for (let i = 0; i < newOccurrences.length; i += batchSize) {
      const batch = newOccurrences.slice(i, i + batchSize);
      const batchPromises = batch.map(occurrence => 
        createMeetingInstance(series, occurrence)
      );
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            createdMeetings.push(result.value);
          } else {
            console.error(`Failed to create meeting for occurrence ${batch[index]}:`, result.reason);
          }
        });
      } catch (error) {
        console.error(`Error processing batch ${i / batchSize + 1}:`, error);
      }
    }

    // Update series metadata
    series.lastGeneratedUntil = toDate;
    series.totalInstances += createdMeetings.length;
    
    // Set next generation date (1 month from now)
    const nextGeneration = new Date();
    nextGeneration.setMonth(nextGeneration.getMonth() + 1);
    series.nextGenerationDate = nextGeneration;
    
    await series.save();

    console.log(`Successfully created ${createdMeetings.length} meeting instances for series ${seriesId}`);
    return createdMeetings;

  } catch (error) {
    console.error(`Error generating meeting instances for series ${seriesId}:`, error);
    throw error;
  }
}

/**
 * Create a single meeting instance from series data
 */
export async function createMeetingInstance(seriesData, occurrenceDate) {
  try {
    // Calculate end time
    const startTime = new Date(occurrenceDate);
    const endTime = new Date(startTime.getTime() + seriesData.duration * 60000);

    // Create base meeting data
    const meetingData = {
      title: seriesData.title,
      description: seriesData.description,
      host: seriesData.host,
      hostId: seriesData.hostId,
      duration: seriesData.duration,
      participants: [...seriesData.participants],
      startTime,
      endTime,
      provider: seriesData.provider,
      
      // Copy tracking settings
      trackOpens: seriesData.trackOpens,
      trackClicks: seriesData.trackClicks,
      trackAck: seriesData.trackAck,
      useInterstitialJoin: seriesData.useInterstitialJoin,
      redirectDelay: seriesData.redirectDelay,
      includeDirectMeetingLink: seriesData.includeDirectMeetingLink,
      
      // Recurring meeting fields
      seriesId: seriesData._id,
      recurrenceInstance: {
        originalDate: occurrenceDate,
        isModified: false,
        isCancelled: false
      },
      
      // Initialize tracking data if tracking is enabled
      tracking: []
    };

    // Copy Zoom settings if using Zoom
    if (seriesData.provider === 'zoom' && seriesData.zoomSettings) {
      meetingData.zoomSettings = { ...seriesData.zoomSettings };
    }

    // Copy Google Meet URL if using Google Meet
    if (seriesData.provider === 'google_meet' && seriesData.joinUrl) {
      meetingData.joinUrl = seriesData.joinUrl;
    }

    // Create provider-specific meeting
    const providerMeeting = await createProviderMeeting(meetingData, seriesData.provider);
    
    // Update meeting data with provider response
    if (providerMeeting) {
      if (seriesData.provider === 'zoom') {
        meetingData.zoomMeetingUrl = providerMeeting.join_url;
        meetingData.zoomMeetingId = providerMeeting.id.toString();
        meetingData.joinUrl = providerMeeting.join_url;
      } else if (seriesData.provider === 'google_meet') {
        // For Google Meet, we might generate unique meeting links or use shared ones
        // This depends on the series configuration
        meetingData.joinUrl = providerMeeting.joinUrl || seriesData.joinUrl;
      }
    }

    // Initialize tracking tokens if tracking is enabled
    if (meetingData.trackOpens || meetingData.trackClicks || meetingData.trackAck) {
      meetingData.tracking = meetingData.participants.map(email => ({
        email,
        token: uuidv4(),
        sentAt: new Date(),
        opened: false,
        clicked: false,
        acknowledged: false
      }));
    }

    // Create the meeting instance
    const meeting = new Event(meetingData);
    await meeting.save();

    console.log(`Created meeting instance ${meeting._id} for ${startTime}`);
    return meeting;

  } catch (error) {
    console.error('Error creating meeting instance:', error);
    throw error;
  }
}

/**
 * Create provider-specific meeting (Zoom or Google Meet) with enhanced error handling
 */
export async function createProviderMeeting(meetingData, provider, options = {}) {
  try {
    switch (provider) {
      case 'zoom':
        return await createZoomMeetingForRecurring(meetingData, options);
      
      case 'google_meet':
        // Determine strategy based on series configuration
        const strategy = meetingData.googleMeetSettings?.strategy || 'shared';
        return await createGoogleMeetForRecurring(meetingData, { 
          strategy, 
          ...options 
        });
      
      default:
        console.warn(`Unknown provider: ${provider}`);
        return null;
    }
  } catch (error) {
    console.error(`Error creating ${provider} meeting:`, error);
    
    // Enhanced error handling with fallback options
    if (error.isZoomError || error.isGoogleMeetError) {
      // Provider-specific error, try fallback if available
      if (options.enableFallback) {
        console.log(`Attempting fallback for ${provider} meeting creation`);
        return await createFallbackMeeting(meetingData, provider, error);
      }
    }
    
    // For recurring meetings, we don't want one failure to stop the entire process
    // Log the error and return null so the meeting can still be created without provider integration
    return null;
  }
}

// Provider-specific meeting creation functions are now imported from their respective modules
// createZoomMeetingForRecurring is imported from './zoom.js'
// createGoogleMeetForRecurring is imported from './googleMeet.js'

/**
 * Handle conflicts when creating meetings
 */
export async function detectAndResolveConflicts(meetingData, options = {}) {
  try {
    await connectToDatabase();
    
    // Check for conflicts with existing meetings
    const conflicts = await Event.find({
      host: meetingData.host,
      startTime: {
        $lt: meetingData.endTime
      },
      endTime: {
        $gt: meetingData.startTime
      },
      status: { $ne: 'cancelled' }
    });

    if (conflicts.length === 0) {
      return { hasConflicts: false, conflicts: [] };
    }

    console.log(`Found ${conflicts.length} potential conflicts for meeting at ${meetingData.startTime}`);

    // Apply conflict resolution strategy
    const strategy = options.conflictStrategy || 'warn';
    
    switch (strategy) {
      case 'skip':
        console.log('Skipping meeting due to conflicts');
        return { hasConflicts: true, conflicts, action: 'skipped' };
      
      case 'override':
        console.log('Creating meeting despite conflicts');
        return { hasConflicts: true, conflicts, action: 'override' };
      
      case 'warn':
      default:
        console.warn('Meeting has conflicts but will be created');
        return { hasConflicts: true, conflicts, action: 'warn' };
    }
    
  } catch (error) {
    console.error('Error detecting conflicts:', error);
    // Don't block meeting creation due to conflict detection errors
    return { hasConflicts: false, conflicts: [], error: error.message };
  }
}

/**
 * Batch process meeting generation for multiple series
 */
export async function batchGenerateMeetings(seriesIds, options = {}) {
  const results = [];
  const batchSize = options.batchSize || 5;
  
  console.log(`Batch generating meetings for ${seriesIds.length} series`);
  
  for (let i = 0; i < seriesIds.length; i += batchSize) {
    const batch = seriesIds.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (seriesId) => {
      try {
        const meetings = await generateMeetingInstances(
          seriesId,
          options.fromDate,
          options.toDate
        );
        return { seriesId, success: true, meetings, count: meetings.length };
      } catch (error) {
        console.error(`Failed to generate meetings for series ${seriesId}:`, error);
        return { seriesId, success: false, error: error.message };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({ success: false, error: result.reason.message });
      }
    });
    
    // Add delay between batches to avoid overwhelming the system
    if (i + batchSize < seriesIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Batch generation complete: ${successful.length} successful, ${failed.length} failed`);
  
  return {
    successful,
    failed,
    totalMeetings: successful.reduce((sum, r) => sum + r.count, 0)
  };
}

/**
 * Get series that need meeting generation
 */
export async function getSeriesNeedingGeneration() {
  try {
    await connectToDatabase();
    
    const now = new Date();
    
    const series = await RecurringSeries.find({
      isActive: true,
      nextGenerationDate: { $lte: now }
    }).lean();
    
    console.log(`Found ${series.length} series needing meeting generation`);
    return series;
    
  } catch (error) {
    console.error('Error getting series needing generation:', error);
    throw error;
  }
}

/**
 * Update meeting instance with provider-specific data
 */
export async function updateMeetingWithProviderData(meetingId, providerData) {
  try {
    await connectToDatabase();
    
    const meeting = await Event.findById(meetingId);
    if (!meeting) {
      throw new Error(`Meeting ${meetingId} not found`);
    }

    if (meeting.provider === 'zoom' && providerData.zoom) {
      meeting.zoomMeetingUrl = providerData.zoom.join_url;
      meeting.zoomMeetingId = providerData.zoom.id.toString();
      meeting.joinUrl = providerData.zoom.join_url;
    } else if (meeting.provider === 'google_meet' && providerData.googleMeet) {
      meeting.joinUrl = providerData.googleMeet.joinUrl;
    }

    await meeting.save();
    console.log(`Updated meeting ${meetingId} with provider data`);
    
    return meeting;
    
  } catch (error) {
    console.error(`Error updating meeting ${meetingId} with provider data:`, error);
    throw error;
  }
}
/**

 * Create fallback meeting when provider APIs fail
 */
async function createFallbackMeeting(meetingData, provider, originalError) {
  console.log(`Creating fallback meeting for ${provider} failure`);
  
  try {
    // Create a manual meeting entry with fallback options
    const fallbackMeeting = {
      title: meetingData.title,
      startTime: meetingData.startTime,
      duration: meetingData.duration,
      provider: provider,
      fallback: true,
      originalError: originalError.message,
      fallbackCreatedAt: new Date().toISOString(),
    };

    if (provider === 'zoom') {
      // For Zoom fallback, provide manual meeting creation instructions
      fallbackMeeting.fallbackInstructions = {
        type: 'manual_zoom',
        message: 'Please create a Zoom meeting manually and update the meeting with the join URL',
        steps: [
          'Go to zoom.us and sign in',
          'Click "Schedule a Meeting"',
          'Set the meeting details',
          'Copy the join URL and update this meeting'
        ]
      };
      
      // Generate a placeholder URL for tracking
      fallbackMeeting.joinUrl = `https://zoom.us/j/manual-${Date.now()}`;
      
    } else if (provider === 'google_meet') {
      // For Google Meet fallback, generate a simple meet link or provide instructions
      const meetingId = generateSimpleMeetId();
      fallbackMeeting.joinUrl = `https://meet.google.com/${meetingId}`;
      fallbackMeeting.fallbackInstructions = {
        type: 'generated_meet',
        message: 'A Google Meet link has been generated. Please verify it works before the meeting.',
        note: 'This is a generated link that may need manual verification'
      };
    }

    // Schedule admin notification about the fallback
    await scheduleAdminNotification({
      type: 'provider_fallback',
      provider,
      meetingId: meetingData._id || meetingData.title,
      seriesId: meetingData.seriesId,
      error: originalError.message,
      fallbackCreated: true,
      scheduledFor: meetingData.startTime,
    });

    console.log(`Created fallback meeting for ${provider}: ${fallbackMeeting.joinUrl}`);
    return fallbackMeeting;

  } catch (fallbackError) {
    console.error('Error creating fallback meeting:', fallbackError);
    
    // If fallback also fails, schedule admin notification and return minimal meeting data
    await scheduleAdminNotification({
      type: 'provider_fallback_failed',
      provider,
      meetingId: meetingData._id || meetingData.title,
      seriesId: meetingData.seriesId,
      originalError: originalError.message,
      fallbackError: fallbackError.message,
      scheduledFor: meetingData.startTime,
    });

    return {
      title: meetingData.title,
      startTime: meetingData.startTime,
      duration: meetingData.duration,
      provider: provider,
      fallback: true,
      fallbackFailed: true,
      joinUrl: null,
      manualSetupRequired: true,
    };
  }
}

/**
 * Schedule admin notification for provider failures
 */
async function scheduleAdminNotification(notificationData) {
  try {
    // This would integrate with the existing notification system
    // For now, we'll log the notification and could extend to email/Slack/etc.
    
    console.warn('ADMIN NOTIFICATION:', JSON.stringify(notificationData, null, 2));
    
    // In a real implementation, this would:
    // 1. Send email to administrators
    // 2. Create a dashboard alert
    // 3. Log to monitoring system
    // 4. Potentially send Slack/Teams notification
    
    // Store notification in database for admin dashboard
    await connectToDatabase();
    
    const notification = {
      type: 'admin_alert',
      category: 'provider_failure',
      severity: notificationData.type.includes('failed') ? 'critical' : 'warning',
      title: `${notificationData.provider} Provider Issue`,
      message: generateAdminNotificationMessage(notificationData),
      data: notificationData,
      createdAt: new Date(),
      acknowledged: false,
      resolvedAt: null,
    };

    // This would be stored in an admin_notifications collection
    console.log('Admin notification created:', notification.title);
    
    return notification;

  } catch (error) {
    console.error('Error scheduling admin notification:', error);
    // Don't throw here as this is a secondary operation
  }
}

/**
 * Generate human-readable admin notification message
 */
function generateAdminNotificationMessage(data) {
  const { type, provider, meetingId, seriesId, error, scheduledFor } = data;
  
  const providerName = provider === 'zoom' ? 'Zoom' : 'Google Meet';
  const meetingTime = new Date(scheduledFor).toLocaleString();
  
  switch (type) {
    case 'provider_fallback':
      return `${providerName} API failed for meeting "${meetingId}" scheduled for ${meetingTime}. Fallback meeting created. Error: ${error}`;
    
    case 'provider_fallback_failed':
      return `CRITICAL: Both ${providerName} API and fallback failed for meeting "${meetingId}" scheduled for ${meetingTime}. Manual intervention required. Errors: ${error} | Fallback: ${data.fallbackError}`;
    
    case 'rate_limit_exceeded':
      return `${providerName} API rate limit exceeded. Multiple meetings may be affected. Consider implementing additional rate limiting or upgrading API plan.`;
    
    case 'provider_outage':
      return `${providerName} API appears to be experiencing an outage. Multiple consecutive failures detected.`;
    
    default:
      return `${providerName} provider issue detected for meeting "${meetingId}". Error: ${error}`;
  }
}

/**
 * Generate simple meet ID for fallback Google Meet links
 */
function generateSimpleMeetId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const part1 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part3 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  return `${part1}-${part2}-${part3}`;
}

/**
 * Enhanced batch meeting generation with comprehensive error handling
 */
export async function batchGenerateMeetingsWithFallback(seriesData, occurrences, options = {}) {
  const {
    batchSize = 5,
    enableFallback = true,
    maxRetries = 3,
    onProgress = null,
    onError = null,
    stopOnCriticalError = false,
  } = options;

  const results = {
    successful: [],
    failed: [],
    fallback: [],
    summary: {
      total: occurrences.length,
      successful: 0,
      failed: 0,
      fallback: 0,
      criticalErrors: 0,
    },
  };

  console.log(`Starting batch meeting generation with fallback: ${occurrences.length} meetings`);

  // Track consecutive failures for outage detection
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 5;

  for (let i = 0; i < occurrences.length; i += batchSize) {
    const batch = occurrences.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(occurrences.length / batchSize);
    
    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} meetings)`);

    for (const occurrence of batch) {
      try {
        const meetingData = {
          ...seriesData,
          startTime: occurrence.date,
          _id: occurrence._id,
        };

        // Create the meeting instance
        const meeting = await createMeetingInstance(seriesData, occurrence.date, {
          enableFallback,
          maxRetries,
        });

        results.successful.push({
          occurrence,
          meeting,
          batchNumber,
        });
        
        results.summary.successful++;
        consecutiveFailures = 0; // Reset on success

      } catch (error) {
        consecutiveFailures++;
        
        console.error(`Error creating meeting for ${occurrence.date}:`, error);

        const errorInfo = {
          occurrence,
          error: error.message,
          batchNumber,
          isCritical: error.isCritical || false,
          isProviderError: error.isZoomError || error.isGoogleMeetError || false,
        };

        // Check if this was resolved with fallback
        if (error.fallbackCreated) {
          results.fallback.push(errorInfo);
          results.summary.fallback++;
        } else {
          results.failed.push(errorInfo);
          results.summary.failed++;
          
          if (errorInfo.isCritical) {
            results.summary.criticalErrors++;
          }
        }

        // Call error callback if provided
        if (onError) {
          onError(errorInfo);
        }

        // Check for potential provider outage
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.warn(`Detected potential ${seriesData.provider} outage: ${consecutiveFailures} consecutive failures`);
          
          await scheduleAdminNotification({
            type: 'provider_outage',
            provider: seriesData.provider,
            consecutiveFailures,
            seriesId: seriesData._id,
            batchNumber,
          });

          // Optionally stop processing if configured to do so
          if (stopOnCriticalError) {
            console.log('Stopping batch processing due to potential provider outage');
            break;
          }
        }

        // Stop processing if too many critical errors
        if (results.summary.criticalErrors > 3 && stopOnCriticalError) {
          console.error('Stopping batch processing due to multiple critical errors');
          break;
        }
      }

      // Report progress
      if (onProgress) {
        onProgress({
          completed: results.summary.successful + results.summary.failed + results.summary.fallback,
          total: occurrences.length,
          successful: results.summary.successful,
          failed: results.summary.failed,
          fallback: results.summary.fallback,
          batchNumber,
          totalBatches,
        });
      }
    }

    // Add delay between batches to avoid overwhelming APIs
    if (i + batchSize < occurrences.length) {
      const delay = consecutiveFailures > 0 ? 5000 : 2000; // Longer delay if there are failures
      console.log(`Waiting ${delay}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Calculate final success rate
  results.summary.successRate = (results.summary.successful / results.summary.total) * 100;
  results.summary.fallbackRate = (results.summary.fallback / results.summary.total) * 100;

  console.log(`Batch generation completed:`, results.summary);

  // Send summary notification to admins if there were significant issues
  if (results.summary.failed > 0 || results.summary.fallback > 0) {
    await scheduleAdminNotification({
      type: 'batch_generation_summary',
      provider: seriesData.provider,
      seriesId: seriesData._id,
      summary: results.summary,
      hasIssues: true,
    });
  }

  return results;
}

/**
 * Health check for provider APIs
 */
export async function checkProviderHealth(provider) {
  try {
    console.log(`Checking ${provider} API health`);
    
    const testMeetingData = {
      title: 'Health Check Test Meeting',
      startTime: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      duration: 30,
    };

    switch (provider) {
      case 'zoom':
        // Try to create and immediately delete a test meeting
        const zoomResult = await createZoomMeetingForRecurring(testMeetingData, { 
          maxRetries: 1 
        });
        
        if (zoomResult && zoomResult.id) {
          // Clean up test meeting
          try {
            await deleteZoomMeetingForRecurring(zoomResult.id, { maxRetries: 1 });
          } catch (deleteError) {
            console.warn('Could not delete test Zoom meeting:', deleteError.message);
          }
          
          return { healthy: true, provider, responseTime: Date.now() };
        }
        break;

      case 'google_meet':
        // For Google Meet, just test link generation
        const meetResult = await createGoogleMeetForRecurring(testMeetingData, { 
          strategy: 'unique',
          maxRetries: 1 
        });
        
        if (meetResult && meetResult.joinUrl) {
          return { healthy: true, provider, responseTime: Date.now() };
        }
        break;

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    return { healthy: false, provider, error: 'No valid response received' };

  } catch (error) {
    console.error(`${provider} health check failed:`, error.message);
    
    return { 
      healthy: false, 
      provider, 
      error: error.message,
      isApiError: error.isZoomError || error.isGoogleMeetError || false,
    };
  }
}