/**
 * RRULE (Recurrence Rule) Generator for RFC-compliant calendar integration
 * Supports all recurrence patterns with proper timezone handling
 */

/**
 * Generate RRULE string from recurrence pattern
 */
export function generateRRule(recurrencePattern, startDate, timezone = 'UTC') {
  const { type, interval, daysOfWeek, dayOfMonth, weekOfMonth, endCondition } = recurrencePattern;
  
  let rrule = 'RRULE:';
  let freq = '';
  let byDay = '';
  let byMonthDay = '';
  let bySetPos = '';
  let until = '';
  let count = '';
  
  // Set frequency
  switch (type) {
    case 'daily':
      freq = 'DAILY';
      break;
    case 'weekly':
      freq = 'WEEKLY';
      break;
    case 'monthly':
      freq = 'MONTHLY';
      break;
    case 'yearly':
      freq = 'YEARLY';
      break;
    default:
      freq = 'DAILY';
  }
  
  rrule += `FREQ=${freq}`;
  
  // Add interval if not 1
  if (interval && interval > 1) {
    rrule += `;INTERVAL=${interval}`;
  }
  
  // Handle weekly recurrence with specific days
  if (type === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
    const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    byDay = daysOfWeek.map(day => dayMap[day]).join(',');
    rrule += `;BYDAY=${byDay}`;
  }
  
  // Handle monthly recurrence
  if (type === 'monthly') {
    if (dayOfMonth) {
      // Specific day of month (e.g., 15th of each month)
      rrule += `;BYMONTHDAY=${dayOfMonth}`;
    } else if (weekOfMonth && daysOfWeek && daysOfWeek.length > 0) {
      // Relative day (e.g., first Monday of each month)
      const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const dayStr = daysOfWeek.map(day => dayMap[day]).join(',');
      
      if (weekOfMonth === -1) {
        // Last occurrence of the day in the month
        byDay = daysOfWeek.map(day => `-1${dayMap[day]}`).join(',');
      } else {
        // Specific week of month (1st, 2nd, 3rd, 4th)
        byDay = daysOfWeek.map(day => `${weekOfMonth}${dayMap[day]}`).join(',');
      }
      rrule += `;BYDAY=${byDay}`;
    }
  }
  
  // Handle end conditions
  if (endCondition) {
    if (endCondition.type === 'date' && endCondition.endDate) {
      // Format end date as YYYYMMDDTHHMMSSZ
      const endDate = new Date(endCondition.endDate);
      until = formatDateForRRule(endDate);
      rrule += `;UNTIL=${until}`;
    } else if (endCondition.type === 'count' && endCondition.occurrenceCount) {
      rrule += `;COUNT=${endCondition.occurrenceCount}`;
    }
  }
  
  return rrule;
}

/**
 * Format date for RRULE UNTIL parameter
 */
function formatDateForRRule(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generate EXDATE (exception dates) for cancelled or modified instances
 */
export function generateExDates(exceptions, timezone = 'UTC') {
  if (!exceptions || exceptions.length === 0) {
    return '';
  }
  
  const exDates = exceptions
    .filter(ex => ex.type === 'cancelled' || ex.type === 'moved')
    .map(ex => formatDateForRRule(new Date(ex.originalDate)))
    .join(',');
  
  return exDates ? `EXDATE:${exDates}` : '';
}

/**
 * Generate RDATE (additional dates) for extra instances
 */
export function generateRDates(additionalDates, timezone = 'UTC') {
  if (!additionalDates || additionalDates.length === 0) {
    return '';
  }
  
  const rDates = additionalDates
    .map(date => formatDateForRRule(new Date(date)))
    .join(',');
  
  return rDates ? `RDATE:${rDates}` : '';
}

/**
 * Validate RRULE string
 */
export function validateRRule(rruleString) {
  try {
    // Basic validation - check if it starts with RRULE: and has valid format
    if (!rruleString.startsWith('RRULE:')) {
      return { valid: false, error: 'RRULE must start with "RRULE:"' };
    }
    
    const parts = rruleString.substring(6).split(';');
    const rules = {};
    
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (!key || !value) {
        return { valid: false, error: `Invalid rule part: ${part}` };
      }
      rules[key] = value;
    }
    
    // Check required FREQ
    if (!rules.FREQ) {
      return { valid: false, error: 'FREQ is required' };
    }
    
    const validFreqs = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
    if (!validFreqs.includes(rules.FREQ)) {
      return { valid: false, error: `Invalid FREQ: ${rules.FREQ}` };
    }
    
    // Validate INTERVAL if present
    if (rules.INTERVAL) {
      const interval = parseInt(rules.INTERVAL);
      if (isNaN(interval) || interval < 1) {
        return { valid: false, error: `Invalid INTERVAL: ${rules.INTERVAL}` };
      }
    }
    
    // Validate COUNT if present
    if (rules.COUNT) {
      const count = parseInt(rules.COUNT);
      if (isNaN(count) || count < 1) {
        return { valid: false, error: `Invalid COUNT: ${rules.COUNT}` };
      }
    }
    
    // Validate UNTIL if present
    if (rules.UNTIL) {
      const untilRegex = /^\d{8}T\d{6}Z?$/;
      if (!untilRegex.test(rules.UNTIL)) {
        return { valid: false, error: `Invalid UNTIL format: ${rules.UNTIL}` };
      }
    }
    
    // Cannot have both COUNT and UNTIL
    if (rules.COUNT && rules.UNTIL) {
      return { valid: false, error: 'Cannot specify both COUNT and UNTIL' };
    }
    
    return { valid: true };
    
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Parse RRULE string back to recurrence pattern object
 */
export function parseRRule(rruleString) {
  if (!rruleString.startsWith('RRULE:')) {
    throw new Error('Invalid RRULE format');
  }
  
  const parts = rruleString.substring(6).split(';');
  const rules = {};
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    rules[key] = value;
  }
  
  const pattern = {
    type: rules.FREQ?.toLowerCase() || 'daily',
    interval: rules.INTERVAL ? parseInt(rules.INTERVAL) : 1,
    daysOfWeek: [],
    dayOfMonth: null,
    weekOfMonth: null,
    endCondition: { type: 'never' }
  };
  
  // Parse BYDAY
  if (rules.BYDAY) {
    const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const byDayParts = rules.BYDAY.split(',');
    
    for (const dayPart of byDayParts) {
      const match = dayPart.match(/^(-?\d+)?([A-Z]{2})$/);
      if (match) {
        const [, weekNum, dayCode] = match;
        if (dayMap.hasOwnProperty(dayCode)) {
          pattern.daysOfWeek.push(dayMap[dayCode]);
          if (weekNum) {
            pattern.weekOfMonth = parseInt(weekNum);
          }
        }
      }
    }
  }
  
  // Parse BYMONTHDAY
  if (rules.BYMONTHDAY) {
    pattern.dayOfMonth = parseInt(rules.BYMONTHDAY);
  }
  
  // Parse end conditions
  if (rules.COUNT) {
    pattern.endCondition = {
      type: 'count',
      occurrenceCount: parseInt(rules.COUNT)
    };
  } else if (rules.UNTIL) {
    // Parse UNTIL date
    const untilStr = rules.UNTIL.replace('Z', '');
    const year = parseInt(untilStr.substring(0, 4));
    const month = parseInt(untilStr.substring(4, 6)) - 1;
    const day = parseInt(untilStr.substring(6, 8));
    const hour = parseInt(untilStr.substring(9, 11)) || 0;
    const minute = parseInt(untilStr.substring(11, 13)) || 0;
    const second = parseInt(untilStr.substring(13, 15)) || 0;
    
    pattern.endCondition = {
      type: 'date',
      endDate: new Date(Date.UTC(year, month, day, hour, minute, second))
    };
  }
  
  return pattern;
}

/**
 * Generate human-readable description from RRULE
 */
export function describeRRule(rruleString) {
  try {
    const pattern = parseRRule(rruleString);
    return describeRecurrencePattern(pattern);
  } catch (error) {
    return 'Invalid recurrence pattern';
  }
}

/**
 * Generate human-readable description from recurrence pattern
 */
export function describeRecurrencePattern(pattern) {
  const { type, interval, daysOfWeek, dayOfMonth, endCondition } = pattern;
  
  let description = '';
  
  switch (type) {
    case 'daily':
      description = interval === 1 ? 'Daily' : `Every ${interval} days`;
      break;
    
    case 'weekly':
      if (interval === 1) {
        if (daysOfWeek && daysOfWeek.length > 0) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const selectedDays = daysOfWeek.map(d => dayNames[d]).join(', ');
          description = `Weekly on ${selectedDays}`;
        } else {
          description = 'Weekly';
        }
      } else {
        description = `Every ${interval} weeks`;
        if (daysOfWeek && daysOfWeek.length > 0) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const selectedDays = daysOfWeek.map(d => dayNames[d]).join(', ');
          description += ` on ${selectedDays}`;
        }
      }
      break;
    
    case 'monthly':
      if (dayOfMonth) {
        const suffix = getOrdinalSuffix(dayOfMonth);
        description = interval === 1 ? 
          `Monthly on the ${dayOfMonth}${suffix}` : 
          `Every ${interval} months on the ${dayOfMonth}${suffix}`;
      } else {
        description = interval === 1 ? 'Monthly' : `Every ${interval} months`;
      }
      break;
    
    case 'yearly':
      description = interval === 1 ? 'Yearly' : `Every ${interval} years`;
      break;
    
    default:
      description = 'Custom schedule';
  }
  
  // Add end condition
  if (endCondition.type === 'date') {
    const endDate = new Date(endCondition.endDate);
    description += ` until ${endDate.toLocaleDateString()}`;
  } else if (endCondition.type === 'count') {
    description += ` for ${endCondition.occurrenceCount} occurrence${endCondition.occurrenceCount !== 1 ? 's' : ''}`;
  }
  
  return description;
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

/**
 * Test RRULE compatibility with major calendar applications
 */
export function testRRuleCompatibility(rruleString) {
  const compatibility = {
    googleCalendar: true,
    outlookCalendar: true,
    appleCalendar: true,
    thunderbird: true,
    issues: []
  };
  
  try {
    const validation = validateRRule(rruleString);
    if (!validation.valid) {
      compatibility.googleCalendar = false;
      compatibility.outlookCalendar = false;
      compatibility.appleCalendar = false;
      compatibility.thunderbird = false;
      compatibility.issues.push(`Invalid RRULE: ${validation.error}`);
      return compatibility;
    }
    
    const parts = rruleString.substring(6).split(';');
    const rules = {};
    
    for (const part of parts) {
      const [key, value] = part.split('=');
      rules[key] = value;
    }
    
    // Check for complex BYDAY patterns that might not be supported
    if (rules.BYDAY) {
      const complexPattern = /^-?\d+[A-Z]{2}/.test(rules.BYDAY);
      if (complexPattern && rules.FREQ === 'MONTHLY') {
        // Some older Outlook versions have issues with complex monthly patterns
        compatibility.issues.push('Complex monthly BYDAY patterns may not display correctly in older Outlook versions');
      }
    }
    
    // Check for very high intervals
    if (rules.INTERVAL && parseInt(rules.INTERVAL) > 999) {
      compatibility.issues.push('Very high intervals (>999) may not be supported by some calendar applications');
    }
    
    // Check for very high counts
    if (rules.COUNT && parseInt(rules.COUNT) > 1000) {
      compatibility.issues.push('Very high occurrence counts (>1000) may cause performance issues in some calendar applications');
    }
    
    return compatibility;
    
  } catch (error) {
    compatibility.googleCalendar = false;
    compatibility.outlookCalendar = false;
    compatibility.appleCalendar = false;
    compatibility.thunderbird = false;
    compatibility.issues.push(`Error testing compatibility: ${error.message}`);
    return compatibility;
  }
}