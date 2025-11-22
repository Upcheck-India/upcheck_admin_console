#!/usr/bin/env node

/**
 * Simple test script for provider integration (no database required)
 * Tests validation and basic functionality
 */

import { validateZoomSettingsForRecurring } from '../src/lib/zoom.js';
import { validateGoogleMeetSettingsForRecurring } from '../src/lib/googleMeet.js';
import { validateProviderSettings, getOptimalBatchConfig } from '../src/lib/providerManager.js';

// Test data
const testZoomSettings = {
  waiting_room: true,
  host_video: false,
  participant_video: false,
  mute_upon_entry: true,
  join_before_host: false,
  jbh_time: 5,
  auto_recording: 'none',
  meeting_authentication: true,
  enforce_login: false,
  alternative_hosts: 'admin@example.com, manager@example.com',
  enforce_login_domains: 'example.com, company.org',
};

const testGoogleMeetSettings = {
  strategy: 'unique',
  joinUrl: 'https://meet.google.com/abc-defg-hij',
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
};

function testValidation() {
  console.log('=== Testing Settings Validation ===\n');
  
  // Test Zoom settings validation
  console.log('Testing Zoom settings validation...');
  const zoomValidation = validateZoomSettingsForRecurring(testZoomSettings);
  console.log('✓ Zoom validation result:', zoomValidation);
  
  if (!zoomValidation.isValid) {
    console.error('❌ Zoom validation failed:', zoomValidation.errors);
    return false;
  }
  
  // Test Google Meet settings validation
  console.log('\nTesting Google Meet settings validation...');
  const meetValidation = validateGoogleMeetSettingsForRecurring(testGoogleMeetSettings);
  console.log('✓ Google Meet validation result:', meetValidation);
  
  if (!meetValidation.isValid) {
    console.error('❌ Google Meet validation failed:', meetValidation.errors);
    return false;
  }
  
  // Test provider manager validation
  console.log('\nTesting provider manager validation...');
  const zoomProviderValidation = validateProviderSettings('zoom', testZoomSettings);
  console.log('✓ Zoom provider validation:', zoomProviderValidation);
  
  const meetProviderValidation = validateProviderSettings('google_meet', testGoogleMeetSettings);
  console.log('✓ Google Meet provider validation:', meetProviderValidation);
  
  return true;
}

function testBatchConfiguration() {
  console.log('\n=== Testing Batch Configuration ===\n');
  
  // Test different scenarios
  const scenarios = [
    { provider: 'zoom', meetings: 10 },
    { provider: 'zoom', meetings: 100 },
    { provider: 'google_meet', meetings: 25 },
    { provider: 'google_meet', meetings: 200 },
  ];
  
  scenarios.forEach(({ provider, meetings }) => {
    console.log(`Testing ${provider} batch config for ${meetings} meetings:`);
    const config = getOptimalBatchConfig(provider, meetings);
    console.log('✓ Config:', config);
  });
  
  return true;
}

function testErrorHandling() {
  console.log('\n=== Testing Error Handling ===\n');
  
  // Test invalid settings
  console.log('Testing invalid Zoom settings...');
  const invalidZoomSettings = {
    waiting_room: 'invalid', // Should be boolean
    jbh_time: 15, // Invalid value
    auto_recording: 'invalid', // Invalid option
    alternative_hosts: 'invalid-email', // Invalid email
  };
  
  const invalidZoomValidation = validateZoomSettingsForRecurring(invalidZoomSettings);
  console.log('✓ Invalid Zoom validation (should fail):', invalidZoomValidation);
  
  if (invalidZoomValidation.isValid) {
    console.error('❌ Validation should have failed for invalid settings');
    return false;
  }
  
  // Test invalid Google Meet settings
  console.log('\nTesting invalid Google Meet settings...');
  const invalidMeetSettings = {
    strategy: 'invalid', // Invalid strategy
    joinUrl: 'invalid-url', // Invalid URL format
    calendarIntegration: 'not-an-object', // Should be object
    botScheduling: {
      enabled: 'not-boolean', // Should be boolean
      joinDelay: -5, // Should be non-negative
    },
  };
  
  const invalidMeetValidation = validateGoogleMeetSettingsForRecurring(invalidMeetSettings);
  console.log('✓ Invalid Google Meet validation (should fail):', invalidMeetValidation);
  
  if (invalidMeetValidation.isValid) {
    console.error('❌ Validation should have failed for invalid settings');
    return false;
  }
  
  // Test unknown provider
  console.log('\nTesting unknown provider...');
  const unknownProviderValidation = validateProviderSettings('unknown_provider', {});
  console.log('✓ Unknown provider validation (should fail):', unknownProviderValidation);
  
  if (unknownProviderValidation.isValid) {
    console.error('❌ Validation should have failed for unknown provider');
    return false;
  }
  
  return true;
}

function testUtilityFunctions() {
  console.log('\n=== Testing Utility Functions ===\n');
  
  // Test batch config for edge cases
  console.log('Testing batch config edge cases...');
  
  try {
    const unknownProviderConfig = getOptimalBatchConfig('unknown_provider', 50);
    console.log('✓ Unknown provider config (fallback):', unknownProviderConfig);
    
    const zeroMeetingsConfig = getOptimalBatchConfig('zoom', 0);
    console.log('✓ Zero meetings config:', zeroMeetingsConfig);
    
    const largeMeetingsConfig = getOptimalBatchConfig('google_meet', 1000);
    console.log('✓ Large meetings config:', largeMeetingsConfig);
    
    return true;
  } catch (error) {
    console.error('❌ Utility function test failed:', error);
    return false;
  }
}

async function runSimpleTests() {
  console.log('🚀 Starting Simple Provider Integration Tests');
  console.log('(No database or API credentials required)\n');
  
  const results = {
    validation: false,
    batchConfig: false,
    errorHandling: false,
    utilities: false,
  };
  
  try {
    results.validation = testValidation();
    results.batchConfig = testBatchConfiguration();
    results.errorHandling = testErrorHandling();
    results.utilities = testUtilityFunctions();
    
    console.log('\n=== Test Results Summary ===');
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const allPassed = Object.values(results).every(result => result);
    console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    if (allPassed) {
      console.log('\n✅ Provider integration validation is working correctly!');
      console.log('The system can handle:');
      console.log('- Settings validation for Zoom and Google Meet');
      console.log('- Batch configuration optimization');
      console.log('- Error handling for invalid inputs');
      console.log('- Fallback configurations for unknown providers');
      console.log('\n📝 Next steps:');
      console.log('- Set up API credentials to test actual meeting creation');
      console.log('- Configure database connection for full integration tests');
      console.log('- Test with real recurring meeting series');
    } else {
      console.log('\n⚠️ Some tests failed. Check the implementation.');
    }
    
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runSimpleTests().catch(console.error);