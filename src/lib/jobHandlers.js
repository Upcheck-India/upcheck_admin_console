/**
 * Job Handlers Registration
 * Registers all job handlers for the scheduler
 */

import { registerJobHandler, startScheduler } from './scheduler.js';
import { generateMeetingInstances } from './meetingGenerator.js';
import { sendReminder, sendSeriesNotification } from './notificationScheduler.js';

/**
 * Initialize all job handlers and start the scheduler
 */
export function initializeJobHandlers() {
  console.log('Initializing job handlers...');

  // Register meeting generation handler
  registerJobHandler('generate_meeting', async (payload) => {
    console.log('Processing generate_meeting job:', payload);
    const { seriesId, fromDate, toDate } = payload;
    return await generateMeetingInstances(seriesId, fromDate, toDate);
  });

  // Register reminder notification handler
  registerJobHandler('send_reminder', async (payload) => {
    console.log('Processing send_reminder job:', payload);
    const { notificationId } = payload;
    return await sendReminder(notificationId);
  });

  // Register series notification handler
  registerJobHandler('send_series_notification', async (payload) => {
    console.log('Processing send_series_notification job:', payload);
    const { seriesId, customMessage } = payload;
    
    // Get the series to find participants
    const { connectToDatabase } = await import('./mongodb.js');
    const RecurringSeries = (await import('../models/RecurringSeries.js')).default;
    
    await connectToDatabase();
    const series = await RecurringSeries.findById(seriesId);
    
    if (!series) {
      throw new Error(`Series ${seriesId} not found`);
    }
    
    return await sendSeriesNotification(seriesId, series.participants);
  });

  // Register cleanup handler
  registerJobHandler('cleanup', async (payload) => {
    console.log('Processing cleanup job:', payload);
    // Implement cleanup logic here
    return { message: 'Cleanup completed' };
  });

  console.log('Job handlers registered successfully');
}

/**
 * Start the job processing system
 */
export function startJobProcessing() {
  console.log('Starting job processing system...');
  
  // Initialize handlers first
  initializeJobHandlers();
  
  // Start the scheduler
  startScheduler();
  
  console.log('Job processing system started');
}