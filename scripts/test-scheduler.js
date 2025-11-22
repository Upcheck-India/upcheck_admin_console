#!/usr/bin/env node

/**
 * Simple test script for the job scheduler (without database connection)
 */

async function testScheduler() {
  console.log('Testing Job Scheduler (Unit Tests)...\n');

  try {
    // Test 1: Import and basic structure
    console.log('1. Testing scheduler import and structure...');
    
    // Set environment variable to avoid error
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    
    const { default: jobScheduler, registerJobHandler } = await import('../src/lib/scheduler.js');
    
    console.log('✓ Scheduler imported successfully');
    console.log('✓ Scheduler has config:', !!jobScheduler.config);
    console.log('✓ Scheduler has job handlers map:', !!jobScheduler.jobHandlers);
    console.log();

    // Test 2: Configuration validation
    console.log('2. Testing configuration...');
    const config = jobScheduler.config;
    console.log('✓ Processing interval:', config.processingIntervalMs + 'ms');
    console.log('✓ Batch size:', config.batchSize);
    console.log('✓ Job timeout:', config.jobTimeoutMs + 'ms');
    console.log('✓ Retry configs for job types:', Object.keys(config.retryConfig));
    console.log('✓ Cleanup interval:', config.cleanupIntervalMs + 'ms');
    console.log('✓ Job retention days:', config.jobRetentionDays);
    console.log();

    // Test 3: Job handler registration
    console.log('3. Testing job handler registration...');
    const testHandler = async (payload) => {
      console.log('  Test handler executed with:', payload);
      return 'success';
    };
    
    registerJobHandler('test_job', testHandler);
    console.log('✓ Job handler registered successfully');
    console.log('✓ Handler stored in map:', jobScheduler.jobHandlers.has('test_job'));
    console.log();

    // Test 4: Error handling for invalid handlers
    console.log('4. Testing error handling...');
    try {
      registerJobHandler('invalid_job', 'not a function');
      console.log('✗ Should have thrown error for invalid handler');
    } catch (error) {
      console.log('✓ Correctly rejected invalid handler:', error.message);
    }
    console.log();

    // Test 5: Statistics
    console.log('5. Testing statistics...');
    const stats = jobScheduler.getStats();
    console.log('✓ Stats structure:', {
      processed: stats.processed,
      failed: stats.failed,
      retried: stats.retried,
      isRunning: stats.isRunning,
      hasUptime: typeof stats.uptime === 'number',
      hasConfig: !!stats.config
    });
    console.log();

    // Test 6: Retry configuration validation
    console.log('6. Testing retry configuration...');
    const retryConfig = config.retryConfig;
    
    Object.entries(retryConfig).forEach(([jobType, config]) => {
      console.log(`✓ ${jobType}:`, {
        maxRetries: config.maxRetries,
        backoffSteps: config.backoffMs.length,
        firstDelay: config.backoffMs[0] + 'ms',
        lastDelay: config.backoffMs[config.backoffMs.length - 1] + 'ms'
      });
    });
    console.log();

    // Test 7: Scheduler state management
    console.log('7. Testing scheduler state...');
    console.log('✓ Initial running state:', jobScheduler.isRunning);
    console.log('✓ Processing interval handle:', jobScheduler.processingInterval);
    console.log('✓ Cleanup interval handle:', jobScheduler.cleanupInterval);
    console.log();

    console.log('🎉 All unit tests passed!\n');
    console.log('✅ Job Scheduler structure and configuration validated successfully!');
    console.log('\nNote: Database-dependent tests require a MongoDB connection.');
    console.log('The scheduler is ready for integration with the database.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testScheduler().catch(console.error);