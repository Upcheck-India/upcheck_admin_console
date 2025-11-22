import axios from 'axios';

let zoomAccessToken = null;
let tokenExpiresAt = null;

const getZoomAccessToken = async () => {
  if (zoomAccessToken && tokenExpiresAt && new Date() < tokenExpiresAt) {
    return zoomAccessToken;
  }

  try {
    const response = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
      {},
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
        },
      }
    );

    zoomAccessToken = response.data.access_token;
    // Zoom tokens expire in 1 hour (3600 seconds). We'll refresh it a bit earlier.
    tokenExpiresAt = new Date(new Date().getTime() + (response.data.expires_in - 300) * 1000);

    console.log('Successfully fetched new Zoom access token.');
    return zoomAccessToken;
  } catch (error) {
    console.error('Error getting Zoom access token:', error.response ? error.response.data : error.message);
    throw new Error('Failed to get Zoom access token.');
  }
};

export const createZoomMeeting = async (event) => {
  const accessToken = await getZoomAccessToken();

  try {
    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        topic: event.title,
        type: 2, // Scheduled meeting
        start_time: event.startTime,
        duration: event.duration,
        timezone: 'UTC',
        settings: {
          // Use settings from the event form, with sensible defaults
          waiting_room: event.zoomSettings?.waiting_room ?? true,
          host_video: event.zoomSettings?.host_video ?? false,
          participant_video: event.zoomSettings?.participant_video ?? false,
          mute_upon_entry: event.zoomSettings?.mute_upon_entry ?? true,
          join_before_host: event.zoomSettings?.join_before_host ?? false,
          jbh_time: event.zoomSettings?.join_before_host ? event.zoomSettings?.jbh_time : undefined,
          watermark: false,
          use_pmi: false,
          approval_type: 0, // Automatically approve
          audio: 'both',
          auto_recording: event.zoomSettings?.auto_recording ?? 'none',
          meeting_authentication: event.zoomSettings?.meeting_authentication ?? true,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating Zoom meeting:', error.response ? error.response.data : error.message);
    throw new Error('Failed to create Zoom meeting.');
  }
};

/**
 * Create Zoom meeting for recurring series with enhanced error handling and rate limiting
 */
export const createZoomMeetingForRecurring = async (meetingData, options = {}) => {
  const { retryCount = 0, maxRetries = 3, batchId = null } = options;
  
  try {
    const accessToken = await getZoomAccessToken();

    const zoomMeetingData = {
      topic: meetingData.title,
      type: 2, // Scheduled meeting
      start_time: meetingData.startTime,
      duration: meetingData.duration,
      timezone: 'UTC',
      settings: {
        // Use settings from the series configuration
        waiting_room: meetingData.zoomSettings?.waiting_room ?? true,
        host_video: meetingData.zoomSettings?.host_video ?? false,
        participant_video: meetingData.zoomSettings?.participant_video ?? false,
        mute_upon_entry: meetingData.zoomSettings?.mute_upon_entry ?? true,
        join_before_host: meetingData.zoomSettings?.join_before_host ?? false,
        jbh_time: meetingData.zoomSettings?.join_before_host ? meetingData.zoomSettings?.jbh_time : undefined,
        watermark: false,
        use_pmi: false,
        approval_type: 0, // Automatically approve
        audio: 'both',
        auto_recording: meetingData.zoomSettings?.auto_recording ?? 'none',
        meeting_authentication: meetingData.zoomSettings?.meeting_authentication ?? true,
        // Recurring meeting specific settings
        enforce_login: meetingData.zoomSettings?.enforce_login ?? false,
        enforce_login_domains: meetingData.zoomSettings?.enforce_login_domains || '',
        alternative_hosts: meetingData.zoomSettings?.alternative_hosts || '',
      },
    };

    // Add batch identifier for tracking if provided
    if (batchId) {
      console.log(`Creating Zoom meeting for batch ${batchId}: ${meetingData.title} at ${meetingData.startTime}`);
    }

    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      zoomMeetingData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`Successfully created Zoom meeting ${response.data.id} for ${meetingData.startTime}`);
    
    return {
      id: response.data.id,
      join_url: response.data.join_url,
      start_url: response.data.start_url,
      password: response.data.password,
      h323_password: response.data.h323_password,
      pstn_password: response.data.pstn_password,
      encrypted_password: response.data.encrypted_password,
      settings: response.data.settings,
      created_at: response.data.created_at,
    };

  } catch (error) {
    console.error(`Error creating Zoom meeting (attempt ${retryCount + 1}/${maxRetries + 1}):`, 
      error.response ? error.response.data : error.message);

    // Handle rate limiting with exponential backoff
    if (error.response?.status === 429 && retryCount < maxRetries) {
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
      console.log(`Rate limited. Retrying in ${backoffDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return createZoomMeetingForRecurring(meetingData, { 
        ...options, 
        retryCount: retryCount + 1 
      });
    }

    // Handle other retryable errors
    if (retryCount < maxRetries && isRetryableError(error)) {
      const backoffDelay = Math.min(2000 * Math.pow(2, retryCount), 60000); // Max 60 seconds
      console.log(`Retryable error. Retrying in ${backoffDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return createZoomMeetingForRecurring(meetingData, { 
        ...options, 
        retryCount: retryCount + 1 
      });
    }

    // Enhance error information for better debugging
    const enhancedError = new Error(`Failed to create Zoom meeting after ${retryCount + 1} attempts`);
    enhancedError.originalError = error;
    enhancedError.meetingData = {
      title: meetingData.title,
      startTime: meetingData.startTime,
      seriesId: meetingData.seriesId,
    };
    enhancedError.isZoomError = true;
    enhancedError.retryCount = retryCount;
    
    throw enhancedError;
  }
};

/**
 * Batch create Zoom meetings with rate limiting and error handling
 */
export const batchCreateZoomMeetings = async (meetingsData, options = {}) => {
  const { 
    batchSize = 5, 
    delayBetweenBatches = 2000,
    maxConcurrent = 3,
    onProgress = null,
    onError = null 
  } = options;

  const results = [];
  const errors = [];
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`Starting batch Zoom meeting creation: ${meetingsData.length} meetings in batches of ${batchSize}`);

  // Process meetings in batches to respect rate limits
  for (let i = 0; i < meetingsData.length; i += batchSize) {
    const batch = meetingsData.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(meetingsData.length / batchSize);
    
    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} meetings)`);

    // Process batch with limited concurrency
    const batchPromises = batch.map(async (meetingData, index) => {
      try {
        // Add small delay between concurrent requests to avoid overwhelming the API
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 500 * index));
        }

        const result = await createZoomMeetingForRecurring(meetingData, { 
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
      });
    }

    // Delay between batches to respect rate limits (except for the last batch)
    if (i + batchSize < meetingsData.length) {
      console.log(`Waiting ${delayBetweenBatches}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log(`Batch creation completed: ${results.length} successful, ${errors.length} failed`);

  return {
    successful: results,
    failed: errors,
    summary: {
      total: meetingsData.length,
      successful: results.length,
      failed: errors.length,
      successRate: (results.length / meetingsData.length) * 100,
    },
  };
};

/**
 * Update Zoom meeting for recurring series
 */
export const updateZoomMeetingForRecurring = async (meetingId, updateData, options = {}) => {
  const { retryCount = 0, maxRetries = 3 } = options;
  
  try {
    const accessToken = await getZoomAccessToken();

    const response = await axios.patch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`Successfully updated Zoom meeting ${meetingId}`);
    return response.data;

  } catch (error) {
    console.error(`Error updating Zoom meeting ${meetingId} (attempt ${retryCount + 1}/${maxRetries + 1}):`, 
      error.response ? error.response.data : error.message);

    if (retryCount < maxRetries && isRetryableError(error)) {
      const backoffDelay = Math.min(2000 * Math.pow(2, retryCount), 60000);
      console.log(`Retrying update in ${backoffDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return updateZoomMeetingForRecurring(meetingId, updateData, { 
        ...options, 
        retryCount: retryCount + 1 
      });
    }

    const enhancedError = new Error(`Failed to update Zoom meeting ${meetingId} after ${retryCount + 1} attempts`);
    enhancedError.originalError = error;
    enhancedError.meetingId = meetingId;
    enhancedError.isZoomError = true;
    
    throw enhancedError;
  }
};

/**
 * Delete Zoom meeting for recurring series
 */
export const deleteZoomMeetingForRecurring = async (meetingId, options = {}) => {
  const { retryCount = 0, maxRetries = 3, sendNotification = true } = options;
  
  try {
    const accessToken = await getZoomAccessToken();

    await axios.delete(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        params: {
          schedule_for_reminder: sendNotification,
        },
      }
    );

    console.log(`Successfully deleted Zoom meeting ${meetingId}`);
    return { success: true, meetingId };

  } catch (error) {
    console.error(`Error deleting Zoom meeting ${meetingId} (attempt ${retryCount + 1}/${maxRetries + 1}):`, 
      error.response ? error.response.data : error.message);

    if (retryCount < maxRetries && isRetryableError(error)) {
      const backoffDelay = Math.min(2000 * Math.pow(2, retryCount), 60000);
      console.log(`Retrying deletion in ${backoffDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return deleteZoomMeetingForRecurring(meetingId, { 
        ...options, 
        retryCount: retryCount + 1 
      });
    }

    const enhancedError = new Error(`Failed to delete Zoom meeting ${meetingId} after ${retryCount + 1} attempts`);
    enhancedError.originalError = error;
    enhancedError.meetingId = meetingId;
    enhancedError.isZoomError = true;
    
    throw enhancedError;
  }
};

/**
 * Get Zoom meeting details for recurring series
 */
export const getZoomMeetingDetails = async (meetingId, options = {}) => {
  const { retryCount = 0, maxRetries = 3 } = options;
  
  try {
    const accessToken = await getZoomAccessToken();

    const response = await axios.get(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;

  } catch (error) {
    console.error(`Error getting Zoom meeting details ${meetingId} (attempt ${retryCount + 1}/${maxRetries + 1}):`, 
      error.response ? error.response.data : error.message);

    if (retryCount < maxRetries && isRetryableError(error)) {
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      console.log(`Retrying get details in ${backoffDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return getZoomMeetingDetails(meetingId, { 
        ...options, 
        retryCount: retryCount + 1 
      });
    }

    const enhancedError = new Error(`Failed to get Zoom meeting details ${meetingId} after ${retryCount + 1} attempts`);
    enhancedError.originalError = error;
    enhancedError.meetingId = meetingId;
    enhancedError.isZoomError = true;
    
    throw enhancedError;
  }
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error) {
  if (!error.response) {
    // Network errors are generally retryable
    return true;
  }

  const status = error.response.status;
  
  // Retryable HTTP status codes
  const retryableStatuses = [
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
  ];

  return retryableStatuses.includes(status);
}

/**
 * Validate Zoom settings for recurring meetings
 */
export const validateZoomSettingsForRecurring = (zoomSettings) => {
  const errors = [];
  
  if (zoomSettings) {
    // Validate boolean settings
    const booleanSettings = [
      'waiting_room', 'host_video', 'participant_video', 'mute_upon_entry',
      'join_before_host', 'meeting_authentication', 'enforce_login'
    ];
    
    booleanSettings.forEach(setting => {
      if (zoomSettings[setting] !== undefined && typeof zoomSettings[setting] !== 'boolean') {
        errors.push(`${setting} must be a boolean value`);
      }
    });

    // Validate jbh_time (join before host time)
    if (zoomSettings.jbh_time !== undefined) {
      const validJbhTimes = [0, 5, 10];
      if (!validJbhTimes.includes(zoomSettings.jbh_time)) {
        errors.push('jbh_time must be 0, 5, or 10 minutes');
      }
    }

    // Validate auto_recording
    if (zoomSettings.auto_recording !== undefined) {
      const validRecordingOptions = ['local', 'cloud', 'none'];
      if (!validRecordingOptions.includes(zoomSettings.auto_recording)) {
        errors.push('auto_recording must be "local", "cloud", or "none"');
      }
    }

    // Validate alternative_hosts (email format)
    if (zoomSettings.alternative_hosts) {
      const emails = zoomSettings.alternative_hosts.split(',').map(email => email.trim());
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      emails.forEach(email => {
        if (email && !emailRegex.test(email)) {
          errors.push(`Invalid email format in alternative_hosts: ${email}`);
        }
      });
    }

    // Validate enforce_login_domains
    if (zoomSettings.enforce_login_domains) {
      const domains = zoomSettings.enforce_login_domains.split(',').map(domain => domain.trim());
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
      
      domains.forEach(domain => {
        if (domain && !domainRegex.test(domain)) {
          errors.push(`Invalid domain format in enforce_login_domains: ${domain}`);
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
