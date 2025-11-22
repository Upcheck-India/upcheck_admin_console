import axios from 'axios';

/**
 * Google Meet integration for recurring meetings
 * Supports both shared meeting links and unique links per occurrence
 */

/**
 * Create Google Meet for recurring series
 * Supports multiple strategies: shared link, unique links, or Google Calendar integration
 */
export const createGoogleMeetForRecurring = async (meetingData, options = {}) => {
  const { 
    strategy = 'shared', // 'shared', 'unique', 'calendar'
    retryCount = 0, 
    maxRetries = 3,
    batchId = null 
  } = options;
  
  try {
    console.log(`Creating Google Meet with strategy "${strategy}" for ${meetingData.title} at ${meetingData.startTime}`);
    
    switch (strategy) {
      case 'shared':
        return await createSharedGoogleMeet(meetingData, options);
      case 'unique':
        return await createUniqueGoogleMeet(meetingData, options);
      case 'calendar':
        return await createGoogleMeetWithCalendar(meetingData, options);
      default:
        throw new Error(`Unknown Google Meet strategy: ${strategy}`);
    }

  } catch (error) {
    console.error(`Error creating Google Meet (attempt ${retryCount + 1}/${maxRetries + 1}):`, error.message);

    if (retryCount < maxRetries && isRetryableError(error)) {
      const backoffDelay = Math.min(2000 * Math.pow(2, retryCount), 60000);
      console.log(`Retrying Google Meet creation in ${backoffDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return createGoogleMeetForRecurring(meetingData, { 
        ...options, 
        retryCount: retryCount + 1 
      });
    }

    const enhancedError = new Error(`Failed to create Google Meet after ${retryCount + 1} attempts`);
    enhancedError.originalError = error;
    enhancedError.meetingData = {
      title: meetingData.title,
      startTime: meetingData.startTime,
      seriesId: meetingData.seriesId,
    };
    enhancedError.isGoogleMeetError = true;
    enhancedError.strategy = strategy;
    
    throw enhancedError;
  }
};

/**
 * Create shared Google Meet link for all instances in the series
 */
async function createSharedGoogleMeet(meetingData, options = {}) {
  // Use the shared meeting link from the series if available
  if (meetingData.joinUrl) {
    console.log(`Using shared Google Meet link for ${meetingData.startTime}`);
    return {
      joinUrl: meetingData.joinUrl,
      meetingId: extractMeetingIdFromUrl(meetingData.joinUrl),
      strategy: 'shared',
      isShared: true,
    };
  }

  // Generate a new shared meeting link if none exists
  // This would typically use Google Calendar API or Google Meet API
  // For now, we'll generate a placeholder that follows Google Meet URL format
  const meetingId = generateGoogleMeetId();
  const joinUrl = `https://meet.google.com/${meetingId}`;
  
  console.log(`Generated shared Google Meet link ${joinUrl} for series`);
  
  return {
    joinUrl,
    meetingId,
    strategy: 'shared',
    isShared: true,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Create unique Google Meet link for each occurrence
 */
async function createUniqueGoogleMeet(meetingData, options = {}) {
  // Generate a unique meeting ID for this specific occurrence
  const meetingId = generateGoogleMeetId();
  const joinUrl = `https://meet.google.com/${meetingId}`;
  
  console.log(`Generated unique Google Meet link ${joinUrl} for ${meetingData.startTime}`);
  
  return {
    joinUrl,
    meetingId,
    strategy: 'unique',
    isShared: false,
    occurrenceDate: meetingData.startTime,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Create Google Meet using Google Calendar API integration
 */
async function createGoogleMeetWithCalendar(meetingData, options = {}) {
  // This would integrate with Google Calendar API to create calendar events
  // with automatic Google Meet links
  
  try {
    // Placeholder for Google Calendar API integration
    // In a real implementation, this would:
    // 1. Authenticate with Google Calendar API
    // 2. Create a calendar event with conferenceData
    // 3. Return the generated Meet link
    
    const calendarEvent = await createGoogleCalendarEvent(meetingData, options);
    
    return {
      joinUrl: calendarEvent.hangoutLink || calendarEvent.conferenceData?.entryPoints?.[0]?.uri,
      meetingId: calendarEvent.conferenceData?.conferenceId,
      calendarEventId: calendarEvent.id,
      strategy: 'calendar',
      isShared: false,
      calendarIntegrated: true,
    };

  } catch (error) {
    console.error('Google Calendar integration failed, falling back to unique link:', error.message);
    // Fallback to unique link generation
    return await createUniqueGoogleMeet(meetingData, options);
  }
}

/**
 * Batch create Google Meet meetings
 */
export const batchCreateGoogleMeetMeetings = async (meetingsData, options = {}) => {
  const { 
    strategy = 'shared',
    batchSize = 10, 
    delayBetweenBatches = 1000,
    maxConcurrent = 5,
    onProgress = null,
    onError = null 
  } = options;

  const results = [];
  const errors = [];
  const batchId = `gmeet_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`Starting batch Google Meet creation: ${meetingsData.length} meetings with strategy "${strategy}"`);

  // For shared strategy, create one link for all meetings
  if (strategy === 'shared' && meetingsData.length > 0) {
    try {
      const sharedMeetResult = await createSharedGoogleMeet(meetingsData[0], { batchId });
      
      // Apply the shared link to all meetings
      meetingsData.forEach((meetingData, index) => {
        results.push({
          success: true,
          meetingData,
          result: {
            ...sharedMeetResult,
            appliedTo: meetingData.startTime,
          },
          index,
        });
      });

      if (onProgress) {
        onProgress({
          completed: meetingsData.length,
          total: meetingsData.length,
          successful: results.length,
          failed: 0,
          strategy: 'shared',
        });
      }

      return {
        successful: results,
        failed: [],
        summary: {
          total: meetingsData.length,
          successful: results.length,
          failed: 0,
          successRate: 100,
          strategy,
        },
      };

    } catch (error) {
      // If shared link creation fails, all meetings fail
      meetingsData.forEach((meetingData, index) => {
        const errorInfo = {
          success: false,
          meetingData,
          error,
          index,
        };
        errors.push(errorInfo);
        
        if (onError) {
          onError(errorInfo);
        }
      });

      return {
        successful: [],
        failed: errors,
        summary: {
          total: meetingsData.length,
          successful: 0,
          failed: errors.length,
          successRate: 0,
          strategy,
        },
      };
    }
  }

  // For unique or calendar strategies, process in batches
  for (let i = 0; i < meetingsData.length; i += batchSize) {
    const batch = meetingsData.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(meetingsData.length / batchSize);
    
    console.log(`Processing Google Meet batch ${batchNumber}/${totalBatches} (${batch.length} meetings)`);

    // Process batch with limited concurrency
    const batchPromises = batch.map(async (meetingData, index) => {
      try {
        // Add small delay between concurrent requests
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 200 * index));
        }

        const result = await createGoogleMeetForRecurring(meetingData, { 
          strategy,
          batchId: `${batchId}_${batchNumber}` 
        });
        
        return {
          success: true,
          meetingData,
          result,
          batchNumber,
          index: i + index,
        };
      } catch (error) {
        const errorInfo = {
          success: false,
          meetingData,
          error,
          batchNumber,
          index: i + index,
        };
        
        if (onError) {
          onError(errorInfo);
        }
        
        return errorInfo;
      }
    });

    // Wait for batch to complete with limited concurrency
    const batchResults = [];
    for (let j = 0; j < batchPromises.length; j += maxConcurrent) {
      const concurrentBatch = batchPromises.slice(j, j + maxConcurrent);
      const concurrentResults = await Promise.all(concurrentBatch);
      batchResults.push(...concurrentResults);
    }

    // Separate successful results from errors
    batchResults.forEach(result => {
      if (result.success) {
        results.push(result);
      } else {
        errors.push(result);
      }
    });

    // Report progress
    if (onProgress) {
      onProgress({
        completed: i + batch.length,
        total: meetingsData.length,
        successful: results.length,
        failed: errors.length,
        batchNumber,
        totalBatches,
        strategy,
      });
    }

    // Delay between batches
    if (i + batchSize < meetingsData.length) {
      console.log(`Waiting ${delayBetweenBatches}ms before next Google Meet batch...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log(`Google Meet batch creation completed: ${results.length} successful, ${errors.length} failed`);

  return {
    successful: results,
    failed: errors,
    summary: {
      total: meetingsData.length,
      successful: results.length,
      failed: errors.length,
      successRate: (results.length / meetingsData.length) * 100,
      strategy,
    },
  };
};

/**
 * Update Google Meet for recurring series
 */
export const updateGoogleMeetForRecurring = async (meetingData, updateData, options = {}) => {
  const { strategy = 'shared', retryCount = 0, maxRetries = 3 } = options;
  
  try {
    console.log(`Updating Google Meet with strategy "${strategy}" for ${meetingData.title}`);
    
    if (strategy === 'calendar' && meetingData.calendarEventId) {
      // Update via Google Calendar API
      return await updateGoogleCalendarEvent(meetingData.calendarEventId, updateData, options);
    } else {
      // For shared or unique strategies, we might need to generate a new link
      // if the meeting details change significantly
      if (updateData.title || updateData.startTime) {
        console.log('Significant changes detected, generating new Google Meet link');
        return await createGoogleMeetForRecurring({
          ...meetingData,
          ...updateData,
        }, { strategy });
      }
      
      // For minor updates, return existing meeting data
      return {
        joinUrl: meetingData.joinUrl,
        meetingId: meetingData.meetingId,
        strategy,
        updated: true,
      };
    }

  } catch (error) {
    console.error(`Error updating Google Meet (attempt ${retryCount + 1}/${maxRetries + 1}):`, error.message);

    if (retryCount < maxRetries && isRetryableError(error)) {
      const backoffDelay = Math.min(2000 * Math.pow(2, retryCount), 60000);
      console.log(`Retrying Google Meet update in ${backoffDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return updateGoogleMeetForRecurring(meetingData, updateData, { 
        ...options, 
        retryCount: retryCount + 1 
      });
    }

    const enhancedError = new Error(`Failed to update Google Meet after ${retryCount + 1} attempts`);
    enhancedError.originalError = error;
    enhancedError.isGoogleMeetError = true;
    
    throw enhancedError;
  }
};

/**
 * Delete Google Meet for recurring series
 */
export const deleteGoogleMeetForRecurring = async (meetingData, options = {}) => {
  const { strategy = 'shared', retryCount = 0, maxRetries = 3 } = options;
  
  try {
    console.log(`Deleting Google Meet with strategy "${strategy}"`);
    
    if (strategy === 'calendar' && meetingData.calendarEventId) {
      // Delete via Google Calendar API
      await deleteGoogleCalendarEvent(meetingData.calendarEventId, options);
    } else if (strategy === 'shared') {
      // For shared links, we don't actually delete the link as other instances might use it
      console.log('Shared Google Meet link preserved for other instances');
    } else {
      // For unique links, there's no API to delete the meeting
      // Google Meet links become inactive when not used
      console.log('Unique Google Meet link will become inactive automatically');
    }

    return { 
      success: true, 
      strategy,
      deleted: strategy === 'calendar',
      preserved: strategy === 'shared',
    };

  } catch (error) {
    console.error(`Error deleting Google Meet (attempt ${retryCount + 1}/${maxRetries + 1}):`, error.message);

    if (retryCount < maxRetries && isRetryableError(error)) {
      const backoffDelay = Math.min(2000 * Math.pow(2, retryCount), 60000);
      console.log(`Retrying Google Meet deletion in ${backoffDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return deleteGoogleMeetForRecurring(meetingData, { 
        ...options, 
        retryCount: retryCount + 1 
      });
    }

    const enhancedError = new Error(`Failed to delete Google Meet after ${retryCount + 1} attempts`);
    enhancedError.originalError = error;
    enhancedError.isGoogleMeetError = true;
    
    throw enhancedError;
  }
};

/**
 * Schedule Upcheck bot for Google Meet recurring meetings
 */
export const scheduleGoogleMeetBot = async (meetingData, options = {}) => {
  const { retryCount = 0, maxRetries = 3 } = options;
  
  try {
    console.log(`Scheduling Upcheck bot for Google Meet: ${meetingData.title} at ${meetingData.startTime}`);
    
    // This would integrate with the existing bot scheduling system
    // For now, we'll return a placeholder response
    const botScheduleResult = await scheduleUpcheckBot({
      meetingId: meetingData._id,
      joinUrl: meetingData.joinUrl,
      startTime: meetingData.startTime,
      duration: meetingData.duration,
      provider: 'google_meet',
      seriesId: meetingData.seriesId,
    });

    console.log(`Successfully scheduled bot for Google Meet ${meetingData._id}`);
    
    return {
      success: true,
      botScheduled: true,
      scheduledAt: new Date().toISOString(),
      botId: botScheduleResult.botId,
    };

  } catch (error) {
    console.error(`Error scheduling Google Meet bot (attempt ${retryCount + 1}/${maxRetries + 1}):`, error.message);

    if (retryCount < maxRetries && isRetryableError(error)) {
      const backoffDelay = Math.min(2000 * Math.pow(2, retryCount), 60000);
      console.log(`Retrying bot scheduling in ${backoffDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return scheduleGoogleMeetBot(meetingData, { 
        ...options, 
        retryCount: retryCount + 1 
      });
    }

    // Bot scheduling failure shouldn't fail the entire meeting creation
    console.warn(`Failed to schedule bot for Google Meet ${meetingData._id}, continuing without bot`);
    
    return {
      success: false,
      botScheduled: false,
      error: error.message,
      fallback: true,
    };
  }
};

// Helper functions

/**
 * Generate a Google Meet meeting ID
 */
function generateGoogleMeetId() {
  // Google Meet IDs typically follow the pattern: xxx-xxxx-xxx
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const part1 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part3 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  return `${part1}-${part2}-${part3}`;
}

/**
 * Extract meeting ID from Google Meet URL
 */
function extractMeetingIdFromUrl(url) {
  const match = url.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
  return match ? match[1] : null;
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error) {
  if (!error.response) {
    return true; // Network errors are generally retryable
  }

  const status = error.response.status;
  const retryableStatuses = [429, 500, 502, 503, 504];
  return retryableStatuses.includes(status);
}

/**
 * Validate Google Meet settings for recurring meetings
 */
export const validateGoogleMeetSettingsForRecurring = (googleMeetSettings) => {
  const errors = [];
  
  if (googleMeetSettings) {
    // Validate strategy
    if (googleMeetSettings.strategy) {
      const validStrategies = ['shared', 'unique', 'calendar'];
      if (!validStrategies.includes(googleMeetSettings.strategy)) {
        errors.push('strategy must be "shared", "unique", or "calendar"');
      }
    }

    // Validate joinUrl format if provided
    if (googleMeetSettings.joinUrl) {
      const meetUrlRegex = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
      if (!meetUrlRegex.test(googleMeetSettings.joinUrl)) {
        errors.push('joinUrl must be a valid Google Meet URL format');
      }
    }

    // Validate calendar integration settings
    if (googleMeetSettings.calendarIntegration) {
      if (typeof googleMeetSettings.calendarIntegration !== 'object') {
        errors.push('calendarIntegration must be an object');
      } else {
        const { calendarId, visibility, sendNotifications } = googleMeetSettings.calendarIntegration;
        
        if (calendarId && typeof calendarId !== 'string') {
          errors.push('calendarIntegration.calendarId must be a string');
        }
        
        if (visibility && !['default', 'public', 'private'].includes(visibility)) {
          errors.push('calendarIntegration.visibility must be "default", "public", or "private"');
        }
        
        if (sendNotifications !== undefined && typeof sendNotifications !== 'boolean') {
          errors.push('calendarIntegration.sendNotifications must be a boolean');
        }
      }
    }

    // Validate bot scheduling settings
    if (googleMeetSettings.botScheduling) {
      if (typeof googleMeetSettings.botScheduling !== 'object') {
        errors.push('botScheduling must be an object');
      } else {
        const { enabled, joinDelay, recordMeeting } = googleMeetSettings.botScheduling;
        
        if (enabled !== undefined && typeof enabled !== 'boolean') {
          errors.push('botScheduling.enabled must be a boolean');
        }
        
        if (joinDelay !== undefined && (typeof joinDelay !== 'number' || joinDelay < 0)) {
          errors.push('botScheduling.joinDelay must be a non-negative number');
        }
        
        if (recordMeeting !== undefined && typeof recordMeeting !== 'boolean') {
          errors.push('botScheduling.recordMeeting must be a boolean');
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Placeholder functions for Google Calendar API integration
// These would be implemented with actual Google Calendar API calls

async function createGoogleCalendarEvent(meetingData, options = {}) {
  // Placeholder for Google Calendar API integration
  console.log('Creating Google Calendar event (placeholder implementation)');
  
  return {
    id: `calendar_event_${Date.now()}`,
    hangoutLink: `https://meet.google.com/${generateGoogleMeetId()}`,
    conferenceData: {
      conferenceId: generateGoogleMeetId(),
      entryPoints: [{
        entryPointType: 'video',
        uri: `https://meet.google.com/${generateGoogleMeetId()}`,
      }],
    },
  };
}

async function updateGoogleCalendarEvent(eventId, updateData, options = {}) {
  // Placeholder for Google Calendar API integration
  console.log(`Updating Google Calendar event ${eventId} (placeholder implementation)`);
  
  return {
    id: eventId,
    updated: true,
  };
}

async function deleteGoogleCalendarEvent(eventId, options = {}) {
  // Placeholder for Google Calendar API integration
  console.log(`Deleting Google Calendar event ${eventId} (placeholder implementation)`);
  
  return {
    id: eventId,
    deleted: true,
  };
}

async function scheduleUpcheckBot(botData) {
  // Placeholder for bot scheduling integration
  console.log('Scheduling Upcheck bot (placeholder implementation)');
  
  return {
    botId: `bot_${Date.now()}`,
    scheduled: true,
  };
}