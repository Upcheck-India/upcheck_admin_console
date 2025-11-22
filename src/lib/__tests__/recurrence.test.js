/**
 * Unit Tests for Recurrence Engine
 * Tests recurrence pattern validation, calculation, and edge cases
 */

import { 
  validateRecurrencePattern, 
  generateOccurrences, 
  getNextOccurrence, 
  getPatternDescription,
  isLeapYear,
  isWeekend
} from '../recurrence.js';

// Simple test runner for Node.js
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('Running Recurrence Engine Tests...\n');
    
    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✓ ${test.name}`);
        this.passed++;
      } catch (error) {
        console.log(`✗ ${test.name}`);
        console.log(`  Error: ${error.message}`);
        this.failed++;
      }
    }
    
    console.log(`\nTest Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}

// Test utilities
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertArrayEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Test suite
const runner = new TestRunner();

// Pattern Validation Tests
runner.test('validates daily pattern correctly', () => {
  const pattern = {
    type: 'daily',
    interval: 1,
    endCondition: { type: 'never' }
  };
  
  const result = validateRecurrencePattern(pattern);
  assert(result.isValid, 'Daily pattern should be valid');
  assertEqual(result.errors.length, 0, 'Should have no errors');
});

runner.test('validates weekly pattern correctly', () => {
  const pattern = {
    type: 'weekly',
    interval: 1,
    daysOfWeek: [1, 3, 5], // Monday, Wednesday, Friday
    endCondition: { type: 'never' }
  };
  
  const result = validateRecurrencePattern(pattern);
  assert(result.isValid, 'Weekly pattern should be valid');
});

runner.test('validates monthly pattern with day of month', () => {
  const pattern = {
    type: 'monthly',
    interval: 1,
    dayOfMonth: 15,
    endCondition: { type: 'never' }
  };
  
  const result = validateRecurrencePattern(pattern);
  assert(result.isValid, 'Monthly pattern with day of month should be valid');
});

runner.test('validates monthly pattern with week and day', () => {
  const pattern = {
    type: 'monthly',
    interval: 1,
    weekOfMonth: 2, // Second week
    dayOfWeek: 1,   // Monday
    endCondition: { type: 'never' }
  };
  
  const result = validateRecurrencePattern(pattern);
  assert(result.isValid, 'Monthly pattern with week and day should be valid');
});

runner.test('rejects invalid pattern type', () => {
  const pattern = {
    type: 'invalid',
    interval: 1,
    endCondition: { type: 'never' }
  };
  
  const result = validateRecurrencePattern(pattern);
  assert(!result.isValid, 'Invalid pattern type should be rejected');
  assert(result.errors.length > 0, 'Should have validation errors');
});

runner.test('rejects invalid interval', () => {
  const pattern = {
    type: 'daily',
    interval: 0,
    endCondition: { type: 'never' }
  };
  
  const result = validateRecurrencePattern(pattern);
  assert(!result.isValid, 'Zero interval should be rejected');
});

runner.test('rejects weekly pattern without days', () => {
  const pattern = {
    type: 'weekly',
    interval: 1,
    endCondition: { type: 'never' }
  };
  
  const result = validateRecurrencePattern(pattern);
  assert(!result.isValid, 'Weekly pattern without days should be rejected');
});

runner.test('validates end condition with date', () => {
  const endDate = new Date('2024-12-31');
  const pattern = {
    type: 'daily',
    interval: 1,
    endCondition: { type: 'date', endDate }
  };
  
  const result = validateRecurrencePattern(pattern);
  assert(result.isValid, 'Pattern with end date should be valid');
});

runner.test('validates end condition with count', () => {
  const pattern = {
    type: 'daily',
    interval: 1,
    endCondition: { type: 'count', occurrenceCount: 10 }
  };
  
  const result = validateRecurrencePattern(pattern);
  assert(result.isValid, 'Pattern with occurrence count should be valid');
});

// Occurrence Generation Tests
runner.test('generates daily occurrences correctly', () => {
  const pattern = {
    type: 'daily',
    interval: 1,
    endCondition: { type: 'count', occurrenceCount: 3 }
  };
  
  const startDate = new Date('2024-01-01T10:00:00Z');
  const occurrences = generateOccurrences(pattern, startDate, 5);
  
  assertEqual(occurrences.length, 3, 'Should generate exactly 3 occurrences');
  assertEqual(occurrences[0].toISOString(), '2024-01-01T10:00:00.000Z');
  assertEqual(occurrences[1].toISOString(), '2024-01-02T10:00:00.000Z');
  assertEqual(occurrences[2].toISOString(), '2024-01-03T10:00:00.000Z');
});

runner.test('generates weekly occurrences correctly', () => {
  const pattern = {
    type: 'weekly',
    interval: 1,
    daysOfWeek: [1], // Monday only
    endCondition: { type: 'count', occurrenceCount: 2 }
  };
  
  const startDate = new Date('2024-01-01T10:00:00Z'); // Monday
  const occurrences = generateOccurrences(pattern, startDate, 5);
  
  assertEqual(occurrences.length, 2, 'Should generate exactly 2 occurrences');
  assertEqual(occurrences[0].toISOString(), '2024-01-01T10:00:00.000Z');
  assertEqual(occurrences[1].toISOString(), '2024-01-08T10:00:00.000Z');
});

runner.test('generates monthly occurrences correctly', () => {
  const pattern = {
    type: 'monthly',
    interval: 1,
    dayOfMonth: 15,
    endCondition: { type: 'count', occurrenceCount: 3 }
  };
  
  const startDate = new Date('2024-01-15T10:00:00Z');
  const occurrences = generateOccurrences(pattern, startDate, 5);
  
  assertEqual(occurrences.length, 3, 'Should generate exactly 3 occurrences');
  assertEqual(occurrences[0].toISOString(), '2024-01-15T10:00:00.000Z');
  assertEqual(occurrences[1].toISOString(), '2024-02-15T10:00:00.000Z');
  assertEqual(occurrences[2].toISOString(), '2024-03-15T10:00:00.000Z');
});

runner.test('respects end date condition', () => {
  const pattern = {
    type: 'daily',
    interval: 1,
    endCondition: { 
      type: 'date', 
      endDate: new Date('2024-01-03T23:59:59Z') 
    }
  };
  
  const startDate = new Date('2024-01-01T10:00:00Z');
  const occurrences = generateOccurrences(pattern, startDate, 10);
  
  assertEqual(occurrences.length, 3, 'Should stop at end date');
});

// Edge Case Tests
runner.test('handles month-end dates correctly', () => {
  const pattern = {
    type: 'monthly',
    interval: 1,
    dayOfMonth: 31,
    endCondition: { type: 'count', occurrenceCount: 3 }
  };
  
  const startDate = new Date('2024-01-31T10:00:00Z');
  const occurrences = generateOccurrences(pattern, startDate, 5);
  
  assertEqual(occurrences.length, 3, 'Should generate 3 occurrences');
  // February should adjust to last day of month (29th in 2024 - leap year)
  assertEqual(occurrences[1].getDate(), 29, 'February should use last day of month');
});

runner.test('handles leap year correctly', () => {
  const pattern = {
    type: 'monthly',
    interval: 1,
    dayOfMonth: 29,
    endCondition: { type: 'count', occurrenceCount: 2 }
  };
  
  const startDate = new Date('2024-02-29T10:00:00Z'); // Leap year
  const occurrences = generateOccurrences(pattern, startDate, 5);
  
  assertEqual(occurrences.length, 2, 'Should generate 2 occurrences');
  assertEqual(occurrences[0].toISOString(), '2024-02-29T10:00:00.000Z');
  // March should have 29th
  assertEqual(occurrences[1].toISOString(), '2024-03-29T10:00:00.000Z');
});

runner.test('handles custom intervals correctly', () => {
  const pattern = {
    type: 'daily',
    interval: 3, // Every 3 days
    endCondition: { type: 'count', occurrenceCount: 3 }
  };
  
  const startDate = new Date('2024-01-01T10:00:00Z');
  const occurrences = generateOccurrences(pattern, startDate, 5);
  
  assertEqual(occurrences.length, 3, 'Should generate 3 occurrences');
  assertEqual(occurrences[0].toISOString(), '2024-01-01T10:00:00.000Z');
  assertEqual(occurrences[1].toISOString(), '2024-01-04T10:00:00.000Z');
  assertEqual(occurrences[2].toISOString(), '2024-01-07T10:00:00.000Z');
});

runner.test('handles weekly pattern with multiple days', () => {
  const pattern = {
    type: 'weekly',
    interval: 1,
    daysOfWeek: [1, 3, 5], // Monday, Wednesday, Friday
    endCondition: { type: 'count', occurrenceCount: 6 }
  };
  
  const startDate = new Date('2024-01-01T10:00:00Z'); // Monday
  const occurrences = generateOccurrences(pattern, startDate, 10);
  
  assertEqual(occurrences.length, 6, 'Should generate 6 occurrences');
  // Should be Mon, Wed, Fri, Mon, Wed, Fri
  assertEqual(occurrences[0].getDay(), 1, 'First should be Monday');
  assertEqual(occurrences[1].getDay(), 3, 'Second should be Wednesday');
  assertEqual(occurrences[2].getDay(), 5, 'Third should be Friday');
});

// Pattern Description Tests
runner.test('creates correct daily pattern description', () => {
  const pattern = {
    type: 'daily',
    interval: 1,
    endCondition: { type: 'never' }
  };
  
  const description = getPatternDescription(pattern);
  assertEqual(description, 'Daily', 'Should describe daily pattern correctly');
});

runner.test('creates correct weekly pattern description', () => {
  const pattern = {
    type: 'weekly',
    interval: 1,
    daysOfWeek: [1, 3, 5],
    endCondition: { type: 'never' }
  };
  
  const description = getPatternDescription(pattern);
  assertEqual(description, 'Weekly on Monday, Wednesday, Friday', 'Should describe weekly pattern correctly');
});

runner.test('creates correct monthly pattern description', () => {
  const pattern = {
    type: 'monthly',
    interval: 1,
    dayOfMonth: 15,
    endCondition: { type: 'never' }
  };
  
  const description = getPatternDescription(pattern);
  assertEqual(description, 'Monthly on the 15th', 'Should describe monthly pattern correctly');
});

runner.test('includes end condition in description', () => {
  const pattern = {
    type: 'daily',
    interval: 1,
    endCondition: { 
      type: 'count', 
      occurrenceCount: 10 
    }
  };
  
  const description = getPatternDescription(pattern);
  assertEqual(description, 'Daily for 10 occurrences', 'Should include end condition');
});

// Utility Function Tests
runner.test('identifies leap years correctly', () => {
  assert(isLeapYear(new Date('2024-01-01')), '2024 should be a leap year');
  assert(!isLeapYear(new Date('2023-01-01')), '2023 should not be a leap year');
  assert(isLeapYear(new Date('2000-01-01')), '2000 should be a leap year');
  assert(!isLeapYear(new Date('1900-01-01')), '1900 should not be a leap year');
});

runner.test('identifies weekends correctly', () => {
  assert(isWeekend(new Date('2024-01-06')), 'Saturday should be weekend'); // Saturday
  assert(isWeekend(new Date('2024-01-07')), 'Sunday should be weekend');   // Sunday
  assert(!isWeekend(new Date('2024-01-08')), 'Monday should not be weekend'); // Monday
});

// Next Occurrence Tests
runner.test('calculates next daily occurrence correctly', () => {
  const pattern = {
    type: 'daily',
    interval: 2,
    endCondition: { type: 'never' }
  };
  
  const fromDate = new Date('2024-01-01T10:00:00Z');
  const nextDate = getNextOccurrence(pattern, fromDate);
  
  assertEqual(nextDate.toISOString(), '2024-01-03T10:00:00.000Z');
});

runner.test('calculates next weekly occurrence correctly', () => {
  const pattern = {
    type: 'weekly',
    interval: 1,
    daysOfWeek: [1], // Monday
    endCondition: { type: 'never' }
  };
  
  const fromDate = new Date('2024-01-01T10:00:00Z'); // Monday
  const nextDate = getNextOccurrence(pattern, fromDate);
  
  assertEqual(nextDate.toISOString(), '2024-01-08T10:00:00.000Z');
});

runner.test('calculates next monthly occurrence correctly', () => {
  const pattern = {
    type: 'monthly',
    interval: 1,
    dayOfMonth: 15,
    endCondition: { type: 'never' }
  };
  
  const fromDate = new Date('2024-01-15T10:00:00Z');
  const nextDate = getNextOccurrence(pattern, fromDate);
  
  assertEqual(nextDate.toISOString(), '2024-02-15T10:00:00.000Z');
});

// Error Handling Tests
runner.test('throws error for invalid pattern in generateOccurrences', () => {
  const pattern = {
    type: 'invalid',
    interval: 1,
    endCondition: { type: 'never' }
  };
  
  const startDate = new Date('2024-01-01T10:00:00Z');
  
  try {
    generateOccurrences(pattern, startDate, 5);
    assert(false, 'Should throw error for invalid pattern');
  } catch (error) {
    assert(error.message.includes('Invalid recurrence pattern'), 'Should throw validation error');
  }
});

// Export test runner for external execution
export { runner };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}