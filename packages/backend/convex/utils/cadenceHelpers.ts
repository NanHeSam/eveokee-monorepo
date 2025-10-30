/**
 * Cadence helper utilities for VAPI call scheduling
 * Determines if a given date matches a user's call cadence
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { CADENCE_DAILY_MASK, MAX_DAYS_SEARCH_FORWARD } from './constants';

export type Cadence = 'daily' | 'weekdays' | 'weekends' | 'custom';

/**
 * Determine whether the reference date (or now) falls on a day included by the cadence in the specified timezone.
 *
 * @param daysOfWeek - For `custom` cadence, array of weekday numbers where 0 = Sunday and 6 = Saturday
 * @param referenceDate - Optional Date to evaluate instead of the current time
 * @returns `true` if the local day of week matches the cadence, `false` otherwise.
 * @throws If `cadence` is `custom` and `daysOfWeek` is missing or empty.
 * @throws If `cadence` is not one of 'daily', 'weekdays', 'weekends', or 'custom'.
 */
export function isTodayInCadence(
  cadence: Cadence,
  timezone: string,
  daysOfWeek?: number[],
  referenceDate?: Date
): boolean {
  const localDayOfWeek = getLocalDayOfWeek(timezone, referenceDate);
  
  switch (cadence) {
    case 'daily':
      return true;
    
    case 'weekdays':
      return localDayOfWeek >= 1 && localDayOfWeek <= 5;
    
    case 'weekends':
      return localDayOfWeek === 0 || localDayOfWeek === 6;
    
    case 'custom':
      if (!daysOfWeek || daysOfWeek.length === 0) {
        throw new Error('Custom cadence requires daysOfWeek array');
      }
      return daysOfWeek.includes(localDayOfWeek);
    
    default:
      throw new Error(`Unknown cadence: ${cadence}`);
  }
}

/**
 * Get the local day of week for a given timezone and reference date.
 *
 * @param timezone - IANA timezone identifier
 * @param referenceDate - Optional reference Date; defaults to the current date and time
 * @returns The day of week as 0 (Sunday) through 6 (Saturday)
 */
function getLocalDayOfWeek(timezone: string, referenceDate?: Date): number {
  const now = referenceDate || new Date();
  const localDate = toZonedTime(now, timezone);
  return localDate.getDay();
}

/**
 * Get human-readable description of cadence
 * @param cadence - Cadence type
 * @param daysOfWeek - Optional days of week array
 * @returns Human-readable string
 */
export function getCadenceDescription(
  cadence: Cadence,
  daysOfWeek?: number[]
): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  switch (cadence) {
    case 'daily':
      return 'Every day';
    
    case 'weekdays':
      return 'Monday through Friday';
    
    case 'weekends':
      return 'Saturday and Sunday';

    case 'custom': {
      if (!daysOfWeek || daysOfWeek.length === 0) {
        return 'Custom (not configured)';
      }
      const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
      const dayNamesList = sortedDays.map(day => dayNames[day]);
      return dayNamesList.join(', ');
    }

    default:
      return 'Unknown';
  }
}

/**
 * Validate a cadence configuration.
 *
 * For `custom` cadence the `daysOfWeek` array must be present, non-empty, and contain only integers 0 (Sunday) through 6 (Saturday). For other cadences no additional configuration is required.
 *
 * @param cadence - The cadence type to validate
 * @param daysOfWeek - Optional array of days for `custom` cadence (0 = Sunday ... 6 = Saturday)
 * @returns `true` if the cadence configuration is valid, `false` otherwise
 */
export function isValidCadenceConfig(
  cadence: Cadence,
  daysOfWeek?: number[]
): boolean {
  if (cadence === 'custom') {
    if (!daysOfWeek || daysOfWeek.length === 0) {
      return false;
    }
    return daysOfWeek.every(day => day >= 0 && day <= 6);
  }
  
  return true;
}

/**
 * Converts an HH:MM 24-hour time string to minutes since midnight (0–1439).
 *
 * @param timeOfDay - Time in `HH:MM` 24-hour format
 * @returns Minutes since midnight
 * @throws Error if `timeOfDay` is not a valid `HH:MM` 24-hour string
 */
export function calculateLocalMinutes(timeOfDay: string): number {
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid timeOfDay format: ${timeOfDay}. Expected HH:MM in 24h format.`);
  }
  return hours * 60 + minutes;
}

/**
 * Convert cadence configuration to 7-bit day-of-week mask
 * @param cadence - Cadence type
 * @param daysOfWeek - Optional custom days array
 * @returns 7-bit mask (bit0=Sunday...bit6=Saturday)
 */
export function calculateBydayMask(
  cadence: Cadence,
  daysOfWeek?: number[]
): number {
  let mask = 0;
  
  switch (cadence) {
    case 'daily':
      // All days: 0b1111111 = 127
      mask = CADENCE_DAILY_MASK;
      break;
    
    case 'weekdays':
      // Mon-Fri: bit1-bit5
      mask = (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5);
      break;
    
    case 'weekends':
      // Sat-Sun: bit0 and bit6
      mask = (1 << 0) | (1 << 6);
      break;
    
    case 'custom':
      if (!daysOfWeek || daysOfWeek.length === 0) {
        throw new Error('Custom cadence requires daysOfWeek array');
      }
      // Set bits for each specified day
      for (const day of daysOfWeek) {
        if (day < 0 || day > 6) {
          throw new Error(`Invalid day value: ${day}. Must be 0-6 (Sunday-Saturday)`);
        }
        mask |= (1 << day);
      }
      break;
    
    default:
      throw new Error(`Unknown cadence: ${cadence}`);
  }
  
  return mask;
}

/**
 * Finds the next UTC timestamp when the cadence should run for the given local time and day mask.
 *
 * Searches forward up to 7 days from `currentTime` and returns the UTC instant corresponding to the next matching local date/time. Throws if no matching run time is found within 7 days.
 *
 * @param localMinutes - Minutes since midnight in the user's local time (0–1439)
 * @param bydayMask - 7-bit mask of allowed days where bit0 = Sunday, bit6 = Saturday
 * @param timezone - IANA timezone identifier used to interpret the local time
 * @param currentTime - Reference current UTC timestamp in milliseconds used as the search origin
 * @returns UTC timestamp in milliseconds for the next scheduled run
 * @throws Error if no run time is found within the next 7 days
 */
export function calculateNextRunAtUTC(
  localMinutes: number,
  bydayMask: number,
  timezone: string,
  currentTime: number = Date.now()
): number {
  // Start from current time and look forward
  const currentUTC = new Date(currentTime);
  
  // Check up to MAX_DAYS_SEARCH_FORWARD days ahead for the next matching day
  for (let daysAhead = 0; daysAhead < MAX_DAYS_SEARCH_FORWARD; daysAhead++) {
    const testUTC = new Date(currentUTC.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    
    // Convert UTC to the user's timezone to get local date components
    const localDate = toZonedTime(testUTC, timezone);
    
    // Get day of week (0=Sunday, 6=Saturday)
    const dayOfWeek = localDate.getDay();
    
    // Check if this day matches the mask
    if ((bydayMask & (1 << dayOfWeek)) !== 0) {
      // This day matches! Now calculate the exact time
      const year = localDate.getFullYear();
      const month = localDate.getMonth();
      const date = localDate.getDate();
      const hours = Math.floor(localMinutes / 60);
      const minutes = localMinutes % 60;
      
      // Create a date at the specified local time on this day
      const localTime = new Date(year, month, date, hours, minutes, 0, 0);
      
      // Convert local time to UTC using date-fns-tz
      const utcTimestamp = fromZonedTime(localTime, timezone).getTime();
      
      // Only return if this time is in the future
      if (utcTimestamp > currentTime) {
        return utcTimestamp;
      }
    }
  }
  
  // If we get here, no match found in the search window (shouldn't happen)
  throw new Error(`Could not find next run time within ${MAX_DAYS_SEARCH_FORWARD} days`);
}

