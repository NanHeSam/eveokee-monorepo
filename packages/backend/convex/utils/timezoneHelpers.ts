/**
 * Timezone helper utilities for VAPI call scheduling
 * Handles IANA timezone conversions with DST awareness
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Convert a local time (HH:MM) in the given IANA timezone to the corresponding UTC timestamp for the reference date.
 *
 * @param timeOfDay - Time in `HH:MM` 24-hour format
 * @param timezone - IANA timezone identifier (for example, `America/New_York`)
 * @param referenceDate - Optional reference `Date`; defaults to the current date/time
 * @returns The UTC timestamp (milliseconds since epoch) that corresponds to the provided local time on the reference date
 */
export function localTimeToUTC(
  timeOfDay: string,
  timezone: string,
  referenceDate?: Date
): number {
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid timeOfDay format: ${timeOfDay}. Expected HH:MM in 24h format.`);
  }

  const reference = referenceDate || new Date();
  
  // Validate timezone first
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}. Must be a valid IANA timezone.`);
  }
  
  try {
    // Get the local date components in the target timezone
    const localDate = toZonedTime(reference, timezone);
    
    // Set the hours and minutes
    const year = localDate.getFullYear();
    const month = localDate.getMonth();
    const day = localDate.getDate();
    
    // Create a new date with the desired time in the local timezone
    const localDateTime = new Date(year, month, day, hours, minutes, 0, 0);
    
    // Convert from local timezone to UTC
    const utcDate = fromZonedTime(localDateTime, timezone);
    
    return utcDate.getTime();
  } catch (error) {
    throw new Error(`Invalid timezone: ${timezone}. Must be a valid IANA timezone.`);
  }
}

/**
 * Get the current local date in the specified IANA timezone.
 *
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @param referenceDate - Optional reference date; defaults to now
 * @returns A Date representing the local date/time in the specified timezone
 * @throws Error if `timezone` is not a valid IANA timezone
 */
export function getLocalDate(timezone: string, referenceDate?: Date): Date {
  const now = referenceDate || new Date();
  
  try {
    return toZonedTime(now, timezone);
  } catch (error) {
    throw new Error(`Invalid timezone: ${timezone}. Must be a valid IANA timezone.`);
  }
}

/**
 * Get the day of week (0-6, Sunday-Saturday) for a date in a specific timezone
 * @param timezone - IANA timezone
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Day of week (0=Sunday, 6=Saturday)
 */
export function getLocalDayOfWeek(timezone: string, referenceDate?: Date): number {
  const localDate = getLocalDate(timezone, referenceDate);
  return localDate.getDay();
}

/**
 * Get start and end of day in UTC for a given timezone
 * @param timezone - IANA timezone
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Object with startOfDay and endOfDay UTC timestamps
 */
export function getUTCDayBounds(
  timezone: string,
  referenceDate?: Date
): { startOfDay: number; endOfDay: number } {
  const startOfDay = localTimeToUTC('00:00', timezone, referenceDate);
  const endOfDay = localTimeToUTC('23:59', timezone, referenceDate);
  
  return { startOfDay, endOfDay };
}

/**
 * Checks whether a string is a valid 24-hour `HH:MM` time.
 *
 * @param time - The time string to validate
 * @returns `true` if `time` matches 24-hour `HH:MM` format (00:00–23:59), `false` otherwise
 */
export function isValidTimeOfDay(time: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(time);
}

/**
 * Check whether a string is a valid IANA time zone identifier.
 *
 * Accepts 'UTC' and 'Etc/UTC' as valid. Explicitly rejects common non-IANA abbreviations
 * such as 'EST', 'PST', 'CST', etc.
 *
 * @param timezone - Time zone identifier to validate
 * @returns `true` if `timezone` is a recognized IANA time zone identifier or an accepted UTC alias, `false` otherwise.
 */
export function isValidTimezone(timezone: string): boolean {
  // Special case: UTC is valid
  if (timezone === 'UTC' || timezone === 'Etc/UTC') {
    return true;
  }
  
  // Reject common non-IANA abbreviation formats (but not UTC)
  if (/^(EST|EDT|CST|CDT|MST|MDT|PST|PDT)$/i.test(timezone)) {
    return false;
  }
  
  try {
    // Use Intl to validate the timezone - this supports all valid IANA timezones
    // including multi-segment paths (America/Indiana/Indianapolis),
    // hyphens (America/Port-au-Prince), and GMT offsets (Etc/GMT+1)
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

