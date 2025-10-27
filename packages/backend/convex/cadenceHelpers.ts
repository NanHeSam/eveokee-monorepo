/**
 * Cadence helper utilities for VAPI call scheduling
 * Determines if a given date matches a user's call cadence
 */

import { getLocalDayOfWeek } from './timezoneHelpers';

export type Cadence = 'daily' | 'weekdays' | 'weekends' | 'custom';

/**
 * Check if today matches the user's call cadence
 * @param cadence - User's cadence setting
 * @param timezone - User's IANA timezone
 * @param daysOfWeek - Optional array of days (0-6) for custom cadence
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns true if today matches the cadence
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
 * Validate cadence configuration
 * @param cadence - Cadence type
 * @param daysOfWeek - Optional days of week array
 * @returns true if valid configuration
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
    
    case 'custom':
      if (!daysOfWeek || daysOfWeek.length === 0) {
        return 'Custom (not configured)';
      }
      const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
      const dayNamesList = sortedDays.map(day => dayNames[day]);
      return dayNamesList.join(', ');
    
    default:
      return 'Unknown';
  }
}
