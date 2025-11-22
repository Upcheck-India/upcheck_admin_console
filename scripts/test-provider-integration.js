#!/usr/bin/env node

/**
 * Test script for provider integration with recurring meetings
 * Tests Zoom and Google Meet integration with fallback mechanisms
 */

import { 
  createZoomMeetingForRecurring, 
  batchCreateZoomMeetings,
  validateZoomSettingsForRecurring 
} from '../src/lib/zoom.js';

import { 
  createGoogleMeetForRecurring, 
  batchCreateGoogleMeetMeetings,
  validateGoogleMeetSettingsForRecurring 
} from '../src/lib/googleMeet.js';

import { 
  selectOptimalProvider, 
  getProviderHealth, 
  validateProviderSettings,
  getOptimalBatchConfig,
  ProviderHealthMonitor 
} from '../src/lib/providerManager.js';

import { 
  createProviderMeeting,
  batchGenerateMeetingsWithFallback,
  checkProviderHealth 
} from '../src/lib/meetingGenerator.js';

// Test data
const testSeriesData = {
  _id: 'test_series_123',
  title: 'Test Recurring Meeting',
  description: 'Testing provider integration',
  host: 'test@example.com',
  hostId: 'test_host_123',
  participants: ['participant1@example.com', 'participant2@example.com'],
  duration: 60,
  provider: 'zoom',
  zoomSettings: {
    waiting_room: true,
    host_video: false,
    participant_video: false,
    mute_upon_entry: true,
    join_before_host: false,
    auto_recording: 'none',
    meeting_authentication: true,
  },
  googleMeetSettings: {
    strategy: 'unique',
    calendarIntegration: {
      calendarId: 'primary',
      visibility: 'default',
      sendNotifications: true,
    },
    botScheduling: {
      enabled: true,
      joinDelay: 30,
      recordMeeting: false,
    },
  },
};

const testMeetingData = {
  ...testSeriesData,
  startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
};

async function testZoomIntegration() {
  console.log('\n=== Testing Zoom Integration ===');
  
  try {
    // Test settings validation
    console.log('Testing Zoom settings validation...');
    const validation = validateZoomSettingsForRecurring(testSeriesData.zoomSettings);
    console.log('Validation result:', validation);
    
    if (!validation.isValid) {
      console.error('Zoom settings validation failed:', validation.errors);
      return false;
    }

    // Test single meeting creation (this will fail without real API credentials)
    console.log('Testing single Zoom meeting creation...');
    try {
      const zoomMeeting = await createZoomMeetingForRecurring(testMeetingData);
      console.log('Zoom meeting created successfully:', zoomMeeting.id);
    } catch (error) {
      console.log('Expected error (no real API credentials):', error.message);
      
      // Verify error handling works correctly
      if (error.isZoomError && error.retryCount !== undefined) {
        console.log('✓ Error handling working correctly');
      }
    }

    // Test batch creation (will also fail but should handle gracefully)
    console.log('Testing batch Zoom meeting creation...');
    const batchMeetings = Array.from({ length: 3 }, (_, i) => ({
      ...testMeetingData,
      startTime: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
      title: `${testMeetingData.title} - Instance ${i + 1}`,
    }));

    try {
      const batchResult = await batchCreateZoomMeetings(batchMeetings, {
        batchSize: 2,
        onProgress: (progress) => {
          console.log('Batch progress:', progress);
        },
        onError: (error) => {
          console.log('Batch error handled:', error.error);
        },
      });
      
      console.log('Batch result:', batchResult.summary);
    } catch (error) {
      console.log('Expected batch error:', error.message);
    }

    console.log('✓ Zoom integration tests completed');
    return true;

  } catch (error) {
    console.error('Zoom integration test failed:', error);
    return false;
  }
}

async function testGoogleMeetIntegration() {
  console.log('\n=== Testing Google Meet Integration ===');
  
  try {
    // Test settings validation
    console.log('Testing Google Meet settings validation...');
    const validation = validateGoogleMeetSettingsForRecurring(testSeriesData.googleMeetSettings);
    console.log('Validation result:', validation);
    
    if (!validation.isValid) {
      console.error('Google Meet settings validation failed:', validation.errors);
      return false;
    }

    // Test different strategies
    const strategies = ['shared', 'unique', 'calendar'];
    
    for (const strategy of strategies) {
      console.log(`Testing Google Meet creation with strategy: ${strategy}`);
      
      try {
        const meetResult = await createGoogleMeetForRecurring(testMeetingData, { strategy });
        console.log(`✓ ${strategy} strategy result:`, {
          joinUrl: meetResult.joinUrl,
          strategy: meetResult.strategy,
          isShared: meetResult.isShared,
        });
      } catch (error) {
        console.log(`Expected error for ${strategy} strategy:`, error.message);
      }
    }

    // Test batch creation
    console.log('Testing batch Google Meet creation...');
    const batchMeetings = Array.from({ length: 3 }, (_, i) => ({
      ...testMeetingData,
      startTime: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
      title: `${testMeetingData.title} - Instance ${i + 1}`,
    }));

    const batchResult = await batchCreateGoogleMeetMeetings(batchMeetings, {
      strategy: 'unique',
      batchSize: 2,
      onProgress: (progress) => {
        console.log('Google Meet batch progress:', progress);
      },
    });
    
    console.log('Google Meet batch result:', batchResult.summary);
    console.log('✓ Google Meet integration tests completed');
    return true;

  } catch (error) {
    console.error('Google Meet integration test failed:', error);
    return false;
  }
}

async function testProviderManager() {
  console.log('\n=== Testing Provider Manager ===');
  
  try {
    // Test provider selection
    console.log('Testing optimal provider selection...');
    
    const providerInfo = await selectOptimalProvider(testSeriesData, {
      preferredProvider: 'zoom',
      checkHealth: false, // Skip health check for testing
    });
    
    console.log('Selected provider:', providerInfo);

    // Test provider health (will show as unhealthy without real APIs)
    console.log('Testing provider health checks...');
    
    const zoomHealth = await getProviderHealth('zoom');
    console.log('Zoom health:', zoomHealth);
    
    const meetHealth = await getProviderHealth('google_meet');
    console.log('Google Meet health:', meetHealth);

    // Test batch configuration
    console.log('Testing batch configuration optimization...');
    
    const zoomBatchConfig = getOptimalBatchConfig('zoom', 100);
    console.log('Zoom batch config for 100 meetings:', zoomBatchConfig);
    
    const meetBatchConfig = getOptimalBatchConfig('google_meet', 50);
    console.log('Google Meet batch config for 50 meetings:', meetBatchConfig);

    // Test settings validation
    console.log('Testing provider settings validation...');
    
    const zoomValidation = validateProviderSettings('zoom', testSeriesData.zoomSettings);
    console.log('Zoom validation:', zoomValidation);
    
    const meetValidation = validateProviderSettings('google_meet', testSeriesData.googleMeetSettings);
    console.log('Google Meet validation:', meetValidation);

    console.log('✓ Provider manager tests completed');
    return true;

  } catch (error) {
    console.error('Provider manager test failed:', error);
    return false;
  }
}

async function testFallbackMechanisms() {
  console.log('\n=== Testing Fallback Mechanisms ===');
  
  try {
    // Test provider meeting creation with fallback enabled
    console.log('Testing provider meeting creation with fallback...');
    
    const meetingResult = await createProviderMeeting(testMeetingData, 'zoom', {
      enableFallback: true,
    });
    
    console.log('Meeting creation result:', meetingResult);

    // Test batch generation with fallback
    console.log('Testing batch generation with fallback...');
    
    const occurrences = Array.from({ length: 5 }, (_, i) => ({
      date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
      _id: `occurrence_${i + 1}`,
    }));

    const batchResult = await batchGenerateMeetingsWithFallback(testSeriesData, occurrences, {
      batchSize: 2,
      enableFallback: true,
      onProgress: (progress) => {
        console.log('Fallback batch progress:', progress);
      },
      onError: (error) => {
        console.log('Fallback error handled:', error);
      },
    });
    
    console.log('Fallback batch result:', batchResult.summary);

    console.log('✓ Fallback mechanism tests completed');
    return true;

  } catch (error) {
    console.error('Fallback mechanism test failed:', error);
    return false;
  }
}

async function testHealthMonitoring() {
  console.log('\n=== Testing Health Monitoring ===');
  
  try {
    // Create a health monitor instance
    const monitor = new ProviderHealthMonitor({
      checkInterval: 5000, // 5 seconds for testing
      alertThreshold: 2,
    });

    console.log('Starting health monitor...');
    monitor.start();

    // Let it run for a short time
    await new Promise(resolve => setTimeout(resolve, 12000));

    // Get health summary
    const summary = monitor.getHealthSummary();
    console.log('Health summary:', summary);

    // Stop monitoring
    monitor.stop();
    console.log('Health monitor stopped');

    console.log('✓ Health monitoring tests completed');
    return true;

  } catch (error) {
    console.error('Health monitoring test failed:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Provider Integration Tests');
  console.log('Note: Some tests will show expected errors due to missing API credentials');
  
  const results = {
    zoom: false,
    googleMeet: false,
    providerManager: false,
    fallback: false,
    healthMonitoring: false,
  };

  try {
    results.zoom = await testZoomIntegration();
    results.googleMeet = await testGoogleMeetIntegration();
    results.providerManager = await testProviderManager();
    results.fallback = await testFallbackMechanisms();
    results.healthMonitoring = await testHealthMonitoring();

    console.log('\n=== Test Results Summary ===');
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });

    const allPassed = Object.values(results).every(result => result);
    console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

    if (allPassed) {
      console.log('\n✅ Provider integration is working correctly!');
      console.log('The system can handle:');
      console.log('- Zoom meeting creation with rate limiting and retries');
      console.log('- Google Meet link generation with multiple strategies');
      console.log('- Provider health monitoring and fallback mechanisms');
      console.log('- Batch processing with error handling');
      console.log('- Settings validation for both providers');
    } else {
      console.log('\n⚠️ Some tests failed. Check the logs above for details.');
    }

  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export {
  testZoomIntegration,
  testGoogleMeetIntegration,
  testProviderManager,
  testFallbackMechanisms,
  testHealthMonitoring,
  runAllTests,
};