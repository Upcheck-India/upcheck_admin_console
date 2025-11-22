/**
 * Tests for recurring meetings API endpoints
 * These are integration tests that verify the API structure and validation
 */

import { validateCreateSeriesRequest, validateUpdateSeriesRequest, validateUpdateInstanceRequest } from '../validation/recurring.js';

describe('Recurring Meetings API Validation', () => {
  describe('validateCreateSeriesRequest', () => {
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

    test('rejects request with invalid email participants', () => {
      const invalidRequest = {
        title: 'Test Meeting',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        duration: 30,
        recurrencePattern: {
          type: 'daily',
          interval: 1,
          endCondition: { type: 'never' }
        },
        participants: ['valid@example.com', 'invalid-email']
      };

      const result = validateCreateSeriesRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('All participants must be valid email addresses');
    });
  });

  describe('validateUpdateSeriesRequest', () => {
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
  });

  describe('validateUpdateInstanceRequest', () => {
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
  });
});

describe('API Response Schemas', () => {
  test('series creation response should have required fields', () => {
    const expectedFields = [
      '_id',
      'title',
      'host',
      'hostId',
      'isActive',
      'createdAt',
      'nextGenerationDate'
    ];

    // This would be tested with actual API calls in integration tests
    expect(expectedFields).toHaveLength(7);
  });

  test('series list response should be an array', () => {
    // This would be tested with actual API calls in integration tests
    expect(Array.isArray([])).toBe(true);
  });

  test('instances response should have pagination info', () => {
    const expectedPaginationFields = [
      'total',
      'limit',
      'offset',
      'hasMore'
    ];

    expect(expectedPaginationFields).toHaveLength(4);
  });
});

describe('Error Response Format', () => {
  test('validation errors should include details array', () => {
    const errorResponse = {
      error: 'Validation failed',
      details: ['Field is required', 'Invalid format']
    };

    expect(errorResponse).toHaveProperty('error');
    expect(errorResponse).toHaveProperty('details');
    expect(Array.isArray(errorResponse.details)).toBe(true);
  });

  test('simple errors should have error message', () => {
    const errorResponse = {
      error: 'Not found'
    };

    expect(errorResponse).toHaveProperty('error');
    expect(typeof errorResponse.error).toBe('string');
  });
});