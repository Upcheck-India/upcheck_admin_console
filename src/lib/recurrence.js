/**
 * Recurrence Pattern Engine
 * Handles validation, calculation, and management of recurring meeting patterns
 */

/**
 * Validates a recurrence pattern object
 * @param {Object} pattern - The recurrence pattern to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export function validateRecurrencePattern(pattern) {
  const errors = [];

  if (!pattern || typeof pattern !== 'object') {
    return { isValid: false, errors: ['Pattern must be an object'] };
  }

  // Validate type
  const validTypes = ['daily', 'weekly', 'monthly', 'custom'];
  if (!pattern.type || !validTypes.includes(pattern.type)) {
    errors.push('Pattern type must be one of: daily, weekly, monthly, custom');
  }

  // Validate interval
  if (!pattern.interval || !Number.isInteger(pattern.interval) || pattern.interval < 1) {
    errors.push('Interval must be a positive integer');
  }

  // Validate weekly pattern
  if (pattern.type === 'weekly') {
    if (!Array.isArray(pattern.daysOfWeek) || pattern.daysOfWeek.length === 0) {
      errors.push('Weekly pattern must specify days of week (0-6, where 0=Sunday)');
    } else {
      const invalidDays = pattern.daysOfWeek.filter(day => 
        !Number.isInteger(day) || day < 0 || day > 6
      );
      if (invalidDays.length > 0) {
        errors.push('Days of week must be integers between 0-6 (0=Sunday)');
      }
    }
  }

  // Validate monthly pattern
  if (pattern.type === 'monthly') {
    if (pattern.dayOfMonth !== undefined) {
      if (!Number.isInteger(pattern.dayOfMonth) || pattern.dayOfMonth < 1 || pattern.dayOfMonth > 31) {
        errors.push('Day of month must be between 1-31');
      }
    } else if (pattern.weekOfMonth !== undefined && pattern.dayOfWeek !== undefined) {
      if (!Number.isInteger(pattern.weekOfMonth) || (pattern.weekOfMonth < 1 || pattern.weekOfMonth > 4) && pattern.weekOfMonth !== -1) {
        errors.push('Week of month must be 1-4 or -1 (last week)');
      }
      if (!Number.isInteger(pattern.dayOfWeek) || pattern.dayOfWeek < 0 || pattern.dayOfWeek > 6) {
        errors.push('Day of week must be between 0-6 (0=Sunday)');
      }
    } else {
      errors.push('Monthly pattern must specify either dayOfMonth or weekOfMonth+dayOfWeek');
    }
  }

  // Validate end condition
  if (!pattern.endCondition || typeof pattern.endCondition !== 'object') {
    errors.push('End condition is required');
  } else {
    const validEndTypes = ['date', 'count', 'never'];
    if (!validEndTypes.includes(pattern.endCondition.type)) {
      errors.push('End condition type must be: date, count, or never');
    }

    if (pattern.endCondition.type === 'date') {
      if (!pattern.endCondition.endDate || !(pattern.endCondition.endDate instanceof Date)) {
        errors.push('End date must be a valid Date object');
      }
    }

    if (pattern.endCondition.type === 'count') {
      if (!Number.isInteger(pattern.endCondition.occurrenceCount) || pattern.endCondition.occurrenceCount < 1) {
        errors.push('Occurrence count must be a positive integer');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generates the next N occurrences based on a recurrence pattern
 * @param {Object} pattern - The recurrence pattern
 * @param {Date} startDate - The start date for the series
 * @param {number} count - Maximum number of occurrences to generate
 * @returns {Date[]} - Array of occurrence dates
 */
export function generateOccurrences(pattern, startDate, count = 50) {
  const validation = validateRecurrencePattern(pattern);
  if (!validation.isValid) {
    throw new Error(`Invalid recurrence pattern: ${validation.errors.join(', ')}`);
  }

  const occurrences = [];
  let currentDate = new Date(startDate);
  let generatedCount = 0;

  // Special handling for weekly patterns with multiple days
  if (pattern.type === 'weekly' && pattern.daysOfWeek && pattern.daysOfWeek.length > 1) {
    return generateWeeklyMultipleDays(pattern, startDate, count);
  }

  while (generatedCount < count) {
    // Check end conditions
    if (pattern.endCondition.type === 'date' && currentDate > pattern.endCondition.endDate) {
      break;
    }
    if (pattern.endCondition.type === 'count' && generatedCount >= pattern.endCondition.occurrenceCount) {
      break;
    }

    // Add current occurrence
    occurrences.push(new Date(currentDate));
    generatedCount++;

    // Calculate next occurrence
    currentDate = getNextOccurrence(pattern, currentDate);
    
    // Safety check to prevent infinite loops
    if (!currentDate) {
      break;
    }
  }

  return occurrences;
}

/**
 * Calculates the next occurrence date from a given date
 * @param {Object} pattern - The recurrence pattern
 * @param {Date} fromDate - The date to calculate from
 * @returns {Date|null} - The next occurrence date or null if no more occurrences
 */
export function getNextOccurrence(pattern, fromDate) {
  const nextDate = new Date(fromDate);

  switch (pattern.type) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + pattern.interval);
      break;

    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (7 * pattern.interval));
      break;

    case 'monthly':
      if (pattern.dayOfMonth !== undefined) {
        // Monthly by date (e.g., 15th of each month)
        const targetYear = nextDate.getFullYear();
        const targetMonth = nextDate.getMonth() + pattern.interval;
        
        // Create a new date for the target month
        const tempDate = new Date(targetYear, targetMonth, pattern.dayOfMonth);
        
        // If the date rolled over to the next month, it means the day doesn't exist
        // in the target month, so use the last day of the target month
        if (tempDate.getMonth() !== (targetMonth % 12)) {
          // Set to last day of the target month
          nextDate.setFullYear(targetYear, targetMonth + 1, 0);
        } else {
          nextDate.setFullYear(targetYear, targetMonth, pattern.dayOfMonth);
        }
      } else {
        // Monthly by week and day (e.g., first Monday of each month)
        nextDate.setMonth(nextDate.getMonth() + pattern.interval);
        const targetDate = getNthWeekdayOfMonth(
          nextDate.getFullYear(),
          nextDate.getMonth(),
          pattern.dayOfWeek,
          pattern.weekOfMonth
        );
        if (targetDate) {
          nextDate.setDate(targetDate.getDate());
        }
      }
      break;

    case 'custom':
      // For custom patterns, treat as daily with custom interval
      nextDate.setDate(nextDate.getDate() + pattern.interval);
      break;

    default:
      return null;
  }

  return nextDate;
}

/**
 * Generates occurrences for weekly patterns with multiple days
 * @param {Object} pattern - The recurrence pattern
 * @param {Date} startDate - The start date
 * @param {number} count - Maximum occurrences to generate
 * @returns {Date[]} - Array of occurrence dates
 */
function generateWeeklyMultipleDays(pattern, startDate, count) {
  const occurrences = [];
  let currentWeekStart = new Date(startDate);
  
  // Move to the start of the week (Sunday)
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
  
  let generatedCount = 0;
  let weekCount = 0;

  while (generatedCount < count) {
    // Check end conditions
    if (pattern.endCondition.type === 'count' && generatedCount >= pattern.endCondition.occurrenceCount) {
      break;
    }

    // Generate occurrences for this week
    for (const dayOfWeek of pattern.daysOfWeek.sort()) {
      if (generatedCount >= count) break;
      if (pattern.endCondition.type === 'count' && generatedCount >= pattern.endCondition.occurrenceCount) {
        break;
      }

      const occurrenceDate = new Date(currentWeekStart);
      occurrenceDate.setDate(currentWeekStart.getDate() + dayOfWeek);
      occurrenceDate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds(), startDate.getMilliseconds());

      // Only include if it's not before the start date
      if (occurrenceDate >= startDate) {
        // Check end date condition
        if (pattern.endCondition.type === 'date' && occurrenceDate > pattern.endCondition.endDate) {
          return occurrences;
        }

        occurrences.push(new Date(occurrenceDate));
        generatedCount++;
      }
    }

    // Move to next week interval
    weekCount++;
    currentWeekStart.setDate(currentWeekStart.getDate() + (7 * pattern.interval));
  }

  return occurrences;
}

/**
 * Gets the Nth occurrence of a weekday in a month
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @param {number} dayOfWeek - Day of week (0=Sunday)
 * @param {number} weekOfMonth - Week of month (1-4, -1=last)
 * @returns {Date|null} - The date or null if not found
 */
function getNthWeekdayOfMonth(year, month, dayOfWeek, weekOfMonth) {
  if (weekOfMonth === -1) {
    // Last occurrence of the weekday in the month
    const lastDay = new Date(year, month + 1, 0);
    while (lastDay.getDay() !== dayOfWeek) {
      lastDay.setDate(lastDay.getDate() - 1);
    }
    return lastDay;
  }

  // Find the Nth occurrence
  const firstDay = new Date(year, month, 1);
  let targetDate = new Date(firstDay);
  
  // Find first occurrence of the weekday
  while (targetDate.getDay() !== dayOfWeek) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  
  // Add weeks to get to the Nth occurrence
  targetDate.setDate(targetDate.getDate() + (7 * (weekOfMonth - 1)));
  
  // Check if we're still in the same month
  if (targetDate.getMonth() !== month) {
    return null;
  }
  
  return targetDate;
}

/**
 * Creates a human-readable description of a recurrence pattern
 * @param {Object} pattern - The recurrence pattern
 * @returns {string} - Human-readable description
 */
export function getPatternDescription(pattern) {
  const validation = validateRecurrencePattern(pattern);
  if (!validation.isValid) {
    return 'Invalid pattern';
  }

  let description = '';

  switch (pattern.type) {
    case 'daily':
      if (pattern.interval === 1) {
        description = 'Daily';
      } else {
        description = `Every ${pattern.interval} days`;
      }
      break;

    case 'weekly':
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const selectedDays = pattern.daysOfWeek.map(day => dayNames[day]).join(', ');
      
      if (pattern.interval === 1) {
        description = `Weekly on ${selectedDays}`;
      } else {
        description = `Every ${pattern.interval} weeks on ${selectedDays}`;
      }
      break;

    case 'monthly':
      if (pattern.dayOfMonth !== undefined) {
        const suffix = getOrdinalSuffix(pattern.dayOfMonth);
        if (pattern.interval === 1) {
          description = `Monthly on the ${pattern.dayOfMonth}${suffix}`;
        } else {
          description = `Every ${pattern.interval} months on the ${pattern.dayOfMonth}${suffix}`;
        }
      } else {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekNames = ['', 'first', 'second', 'third', 'fourth'];
        const weekName = pattern.weekOfMonth === -1 ? 'last' : weekNames[pattern.weekOfMonth];
        const dayName = dayNames[pattern.dayOfWeek];
        
        if (pattern.interval === 1) {
          description = `Monthly on the ${weekName} ${dayName}`;
        } else {
          description = `Every ${pattern.interval} months on the ${weekName} ${dayName}`;
        }
      }
      break;

    case 'custom':
      description = `Every ${pattern.interval} days`;
      break;
  }

  // Add end condition
  if (pattern.endCondition.type === 'date') {
    description += ` until ${pattern.endCondition.endDate.toLocaleDateString()}`;
  } else if (pattern.endCondition.type === 'count') {
    description += ` for ${pattern.endCondition.occurrenceCount} occurrences`;
  }

  return description;
}

/**
 * Gets the ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 * @param {number} num - The number
 * @returns {string} - The ordinal suffix
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
 * Handles timezone-aware date calculations
 * @param {Date} date - The date to process
 * @param {string} timezone - The timezone (optional)
 * @returns {Date} - Timezone-adjusted date
 */
export function adjustForTimezone(date, timezone = null) {
  if (!timezone) {
    return new Date(date);
  }
  
  // For now, return the date as-is
  // In a full implementation, you'd use a library like date-fns-tz
  return new Date(date);
}

/**
 * Checks if a date falls on a weekend
 * @param {Date} date - The date to check
 * @returns {boolean} - True if weekend
 */
export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Checks if a date is a leap year
 * @param {Date} date - The date to check
 * @returns {boolean} - True if leap year
 */
export function isLeapYear(date) {
  const year = date.getFullYear();
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}