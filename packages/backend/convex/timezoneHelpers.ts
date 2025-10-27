/**
 * Timezone helper utilities for VAPI call scheduling
 * Handles IANA timezone conversions with DST awareness
 */

/**
 * Convert a local time (HH:MM) in a specific timezone to UTC timestamp for today
 * @param timeOfDay - Time in HH:MM format (24h)
 * @param timezone - IANA timezone (e.g., "America/New_York")
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns UTC timestamp in milliseconds
 */
export function localTimeToUTC(
  timeOfDay: string,
  timezone: string,
  referenceDate?: Date
): number {
  const now = referenceDate || new Date();
  
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid timeOfDay format: ${timeOfDay}. Expected HH:MM in 24h format.`);
  }

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  
  const dateString = `${year}-${month}-${day}T${hoursStr}:${minutesStr}:00`;
  
  try {
    const localDate = new Date(dateString);
    
    const offset = getTimezoneOffset(timezone, localDate);
    
    const utcTimestamp = localDate.getTime() - (offset * 60 * 1000);
    
    return utcTimestamp;
  } catch (error) {
    throw new Error(`Invalid timezone: ${timezone}. Must be a valid IANA timezone.`);
  }
}

/**
 * Get the timezone offset in minutes for a given timezone at a specific date
 * Positive offset means timezone is ahead of UTC
 * @param timezone - IANA timezone
 * @param date - Date to check offset for (handles DST)
 * @returns Offset in minutes
 */
function getTimezoneOffset(timezone: string, date: Date): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  
  const offset = (tzDate.getTime() - utcDate.getTime()) / (60 * 1000);
  
  return offset;
}

/**
 * Get the current local date in a specific timezone
 * @param timezone - IANA timezone
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Date object representing local date
 */
export function getLocalDate(timezone: string, referenceDate?: Date): Date {
  const now = referenceDate || new Date();
  
  try {
    const localDateString = now.toLocaleString('en-US', { 
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    return new Date(localDateString);
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
 * Validate E.164 phone number format
 * @param phone - Phone number to validate
 * @returns true if valid E.164 format
 */
export function isValidE164(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Validate HH:MM time format
 * @param time - Time string to validate
 * @returns true if valid HH:MM format
 */
export function isValidTimeOfDay(time: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(time);
}

/**
 * Validate IANA timezone
 * @param timezone - Timezone string to validate
 * @returns true if valid IANA timezone
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}
