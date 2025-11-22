/**
 * Test script for job handlers
 */

import { startJobProcessing } from '../src/lib/jobHandlers.js';
import { scheduleJob } from '../src/lib/scheduler.js';
import { connectToDatabase } from '../src/lib/mongodb.js';
import RecurringSeries from '../src/models/RecurringSeries.js';

async function testJobHandlers() {
  try {
    console.log('Testing job handlers...');
    
    // Initialize job processing
    startJobProcessing();
    
    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Connect to database
    await connectToDatabase();
    
    // Find a recent recurring series
    const series = await RecurringSeries.findOne().sort({ createdAt: -1 });
    
    if (!series) {
      console.log('No recurring series found to test with');
      return;
    }
    
    console.log(`Found series: ${series.title} (${series._id})`);
    
    // Schedule a test series notification
    console.log('Scheduling test series notification...');
    await scheduleJob('send_series_notification', {
      seriesId: series._id.toString()
    }, new Date());
    
    console.log('Test job scheduled successfully');
    
    // Wait for job to be processed
    console.log('Waiting for job to be processed...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Test completed');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testJobHandlers().then(() => {
  console.log('Test script finished');
  process.exit(0);
}).catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});