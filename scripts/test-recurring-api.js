#!/usr/bin/env node

/**
 * Simple test script for recurring meetings API validation
 */

import { validateCreateSeriesRequest, validateUpdateSeriesRequest, validateUpdateInstanceRequest } from '../src/lib/validation/recurring.js';

// Test utilities
let testCount = 0;
let passedTests = 0;
let failedTests = 0;

function test(description, testFn) {
  testCount++;
  try {
    testFn();
    console.log(`✅ ${description}`);
    passedTests++;
  } catch (error) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${error.message}`);
    failedTests++;
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected array to contain "${expected}", got ${JSON.stringify(actual)}`);
      }
    },
    toHaveLength: (expected) => {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${actual.length}`);
      }
    }
  };
}

console.log('🧪 Running Recurring Meetings API Validation Tests\n');

// Test validateCreateSeriesRequest
console.log('📋 Testing validateCreateSeriesRequest...');

test('validates valid create request', () => {
  const validRequest = {
    title: 'Test Meeting',
    startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    duration: 30,
    recurrencePattern: {
      type: 'weekly',
      interval: 1,
      daysOfWeek: [1, 3, 5],
      endCondition: {
        type: 'count',
        occurrenceCount: 10
      }
    },
    participants: ['test@example.com'],
    provider: 'zoom'
  };

  const result = validateCreateSeriesRequest(validRequest);
  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('rejects request with missing title', () => {
  const invalidRequest = {
    startTime: new Date(Date.now() + 86400000).toISOString(),
    duration: 30,
    recurrencePattern: {
      type: 'daily',
      interval: 1,
      endCondition: { type: 'never' }
    }
  };

  const result = validateCreateSeriesRequest(invalidRequest);
  expect(result.isValid).toBe(false);
  expect(result.errors).toContain('Title is required and must be a non-empty string');
});

test('rejects request with past start time', () => {
  const invalidRequest = {
    title: 'Test Meeting',
    startTime: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    duration: 30,
    recurrencePattern: {
      type: 'daily',
      interval: 1,
      endCondition: { type: 'never' }
    }
  };

  const result = validateCreateSeriesRequest(invalidRequest);
  expect(result.isValid).toBe(false);
  expect(result.errors).toContain('Start time must be in the future');
});

test('rejects request with invalid duration', () => {
  const invalidRequest = {
    title: 'Test Meeting',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    duration: 500, // Too long
    recurrencePattern: {
      type: 'daily',
      interval: 1,
      endCondition: { type: 'never' }
    }
  };

  const result = validateCreateSeriesRequest(invalidRequest);
  expect(result.isValid).toBe(false);
  expect(result.errors).toContain('Duration must be between 1 and 300 minutes');
});

test('rejects Google Meet request without joinUrl', () => {
  const invalidRequest = {
    title: 'Test Meeting',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    duration: 30,
    recurrencePattern: {
      type: 'daily',
      interval: 1,
      endCondition: { type: 'never' }
    },
    provider: 'google_meet'
    // Missing joinUrl
  };

  const result = validateCreateSeriesRequest(invalidRequest);
  expect(result.isValid).toBe(false);
  expect(result.errors).toContain('Google Meet link (joinUrl) is required for Google Meet provider');
});

// Test validateUpdateSeriesRequest
console.log('\n📝 Testing validateUpdateSeriesRequest...');

test('validates valid update request', () => {
  const validRequest = {
    title: 'Updated Meeting',
    duration: 45,
    participants: ['updated@example.com']
  };

  const result = validateUpdateSeriesRequest(validRequest);
  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('validates empty update request', () => {
  const emptyRequest = {};

  const result = validateUpdateSeriesRequest(emptyRequest);
  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('rejects request with invalid duration', () => {
  const invalidRequest = {
    duration: 0
  };

  const result = validateUpdateSeriesRequest(invalidRequest);
  expect(result.isValid).toBe(false);
  expect(result.errors).toContain('Duration must be between 1 and 300 minutes');
});

// Test validateUpdateInstanceRequest
console.log('\n🔧 Testing validateUpdateInstanceRequest...');

test('validates valid instance update request', () => {
  const validRequest = {
    title: 'Updated Instance',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    participants: ['participant@example.com']
  };

  const result = validateUpdateInstanceRequest(validRequest);
  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('rejects request with invalid start time', () => {
  const invalidRequest = {
    startTime: 'invalid-date'
  };

  const result = validateUpdateInstanceRequest(invalidRequest);
  expect(result.isValid).toBe(false);
  expect(result.errors).toContain('Start time must be a valid date');
});

test('rejects request with empty title', () => {
  const invalidRequest = {
    title: ''
  };

  const result = validateUpdateInstanceRequest(invalidRequest);
  expect(result.isValid).toBe(false);
  expect(result.errors).toContain('Title must be a non-empty string');
});

// Summary
console.log('\n📊 Test Results:');
console.log(`Total tests: ${testCount}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('\n💥 Some tests failed!');
  process.exit(1);
}