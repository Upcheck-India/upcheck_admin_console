/**
 * Validation utilities for recurring meeting API endpoints
 */

import { validateRecurrencePattern } from '../recurrence.js';

/**
 * Validates recurring series creation request
 */
export function validateCreateSeriesRequest(body) {
  const errors = [];
  
  // Required fields
  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    errors.push('Title is required and must be a non-empty string');
  }
  
  if (!body.startTime) {
    errors.push('Start time is required');
  } else {
    const startDate = new Date(body.startTime);
    if (isNaN(startDate.getTime())) {
      errors.push('Start time must be a valid date');
    } else if (startDate < new Date()) {
      errors.push('Start time must be in the future');
    }
  }
  
  if (!body.duration) {
    errors.push('Duration is required');
  } else {
    const duration = parseInt(body.duration, 10);
    if (isNaN(duration) || duration < 1 || duration > 300) {
      errors.push('Duration must be between 1 and 300 minutes');
    }
  }
  
  if (!body.recurrencePattern) {
    errors.push('Recurrence pattern is required');
  } else {
    const patternValidation = validateRecurrencePattern(body.recurrencePattern);
    if (!patternValidation.isValid) {
      errors.push(...patternValidation.errors.map(err => `Recurrence pattern: ${err}`));
    }
  }
  
  // Provider-specific validation
  if (body.provider === 'google_meet' && (!body.joinUrl || typeof body.joinUrl !== 'string')) {
    errors.push('Google Meet link (joinUrl) is required for Google Meet provider');
  }
  
  // Participants validation
  if (body.participants && Array.isArray(body.participants)) {
    const invalidEmails = body.participants.filter(email => 
      typeof email !== 'string' || !isValidEmail(email)
    );
    if (invalidEmails.length > 0) {
      errors.push('All participants must be valid email addresses');
    }
  }
  
  // Reminder settings validation
  if (body.reminderSettings && Array.isArray(body.reminderSettings)) {
    body.reminderSettings.forEach((reminder, index) => {
      if (typeof reminder.timing !== 'number' || reminder.timing < 0) {
        errors.push(`Reminder ${index + 1}: timing must be a non-negative number`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates series update request
 */
export function validateUpdateSeriesRequest(body) {
  const errors = [];
  
  // Optional field validation
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim().length === 0)) {
    errors.push('Title must be a non-empty string');
  }
  
  if (body.duration !== undefined) {
    const duration = parseInt(body.duration, 10);
    if (isNaN(duration) || duration < 1 || duration > 300) {
      errors.push('Duration must be between 1 and 300 minutes');
    }
  }
  
  if (body.recurrencePattern !== undefined) {
    const patternValidation = validateRecurrencePattern(body.recurrencePattern);
    if (!patternValidation.isValid) {
      errors.push(...patternValidation.errors.map(err => `Recurrence pattern: ${err}`));
    }
  }
  
  if (body.participants !== undefined && Array.isArray(body.participants)) {
    const invalidEmails = body.participants.filter(email => 
      typeof email !== 'string' || !isValidEmail(email)
    );
    if (invalidEmails.length > 0) {
      errors.push('All participants must be valid email addresses');
    }
  }
  
  if (body.reminderSettings !== undefined && Array.isArray(body.reminderSettings)) {
    body.reminderSettings.forEach((reminder, index) => {
      if (typeof reminder.timing !== 'number' || reminder.timing < 0) {
        errors.push(`Reminder ${index + 1}: timing must be a non-negative number`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates instance update request
 */
export function validateUpdateInstanceRequest(body) {
  const errors = [];
  
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim().length === 0)) {
    errors.push('Title must be a non-empty string');
  }
  
  if (body.duration !== undefined) {
    const duration = parseInt(body.duration, 10);
    if (isNaN(duration) || duration < 1 || duration > 300) {
      errors.push('Duration must be between 1 and 300 minutes');
    }
  }
  
  if (body.startTime !== undefined) {
    const startDate = new Date(body.startTime);
    if (isNaN(startDate.getTime())) {
      errors.push('Start time must be a valid date');
    }
  }
  
  if (body.participants !== undefined && Array.isArray(body.participants)) {
    const invalidEmails = body.participants.filter(email => 
      typeof email !== 'string' || !isValidEmail(email)
    );
    if (invalidEmails.length > 0) {
      errors.push('All participants must be valid email addresses');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Simple email validation
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates pagination parameters
 */
export function validatePaginationParams(url) {
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const offset = parseInt(url.searchParams.get('offset')) || 0;
  
  const errors = [];
  
  if (limit < 1 || limit > 100) {
    errors.push('Limit must be between 1 and 100');
  }
  
  if (offset < 0) {
    errors.push('Offset must be non-negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    limit: Math.min(Math.max(limit, 1), 100),
    offset: Math.max(offset, 0)
  };
}

/**
 * Validates date range parameters
 */
export function validateDateRangeParams(url) {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  
  const errors = [];
  let parsedStartDate = null;
  let parsedEndDate = null;
  
  if (startDate) {
    parsedStartDate = new Date(startDate);
    if (isNaN(parsedStartDate.getTime())) {
      errors.push('Start date must be a valid date');
    }
  }
  
  if (endDate) {
    parsedEndDate = new Date(endDate);
    if (isNaN(parsedEndDate.getTime())) {
      errors.push('End date must be a valid date');
    }
  }
  
  if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
    errors.push('Start date must be before end date');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    startDate: parsedStartDate,
    endDate: parsedEndDate
  };
}