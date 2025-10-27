import { describe, it, expect } from 'vitest';
import {
  isTodayInCadence,
  isValidCadenceConfig,
  getCadenceDescription,
} from '../convex/cadenceHelpers';

describe('cadenceHelpers', () => {
  describe('isTodayInCadence', () => {
    it('should return true for daily cadence on any day', () => {
      const monday = new Date('2024-01-15T12:00:00Z');
      expect(isTodayInCadence('daily', 'UTC', undefined, monday)).toBe(true);
      
      const saturday = new Date('2024-01-20T12:00:00Z');
      expect(isTodayInCadence('daily', 'UTC', undefined, saturday)).toBe(true);
      
      const sunday = new Date('2024-01-21T12:00:00Z');
      expect(isTodayInCadence('daily', 'UTC', undefined, sunday)).toBe(true);
    });

    it('should return true for weekdays cadence on Mon-Fri', () => {
      const monday = new Date('2024-01-15T12:00:00Z');
      expect(isTodayInCadence('weekdays', 'UTC', undefined, monday)).toBe(true);
      
      const wednesday = new Date('2024-01-17T12:00:00Z');
      expect(isTodayInCadence('weekdays', 'UTC', undefined, wednesday)).toBe(true);
      
      const friday = new Date('2024-01-19T12:00:00Z');
      expect(isTodayInCadence('weekdays', 'UTC', undefined, friday)).toBe(true);
    });

    it('should return false for weekdays cadence on Sat-Sun', () => {
      const saturday = new Date('2024-01-20T12:00:00Z');
      expect(isTodayInCadence('weekdays', 'UTC', undefined, saturday)).toBe(false);
      
      const sunday = new Date('2024-01-21T12:00:00Z');
      expect(isTodayInCadence('weekdays', 'UTC', undefined, sunday)).toBe(false);
    });

    it('should return true for weekends cadence on Sat-Sun', () => {
      const saturday = new Date('2024-01-20T12:00:00Z');
      expect(isTodayInCadence('weekends', 'UTC', undefined, saturday)).toBe(true);
      
      const sunday = new Date('2024-01-21T12:00:00Z');
      expect(isTodayInCadence('weekends', 'UTC', undefined, sunday)).toBe(true);
    });

    it('should return false for weekends cadence on Mon-Fri', () => {
      const monday = new Date('2024-01-15T12:00:00Z');
      expect(isTodayInCadence('weekends', 'UTC', undefined, monday)).toBe(false);
      
      const friday = new Date('2024-01-19T12:00:00Z');
      expect(isTodayInCadence('weekends', 'UTC', undefined, friday)).toBe(false);
    });

    it('should handle custom cadence with specific days', () => {
      const customDays = [1, 3, 5];
      
      const monday = new Date('2024-01-15T12:00:00Z');
      expect(isTodayInCadence('custom', 'UTC', customDays, monday)).toBe(true);
      
      const tuesday = new Date('2024-01-16T12:00:00Z');
      expect(isTodayInCadence('custom', 'UTC', customDays, tuesday)).toBe(false);
      
      const wednesday = new Date('2024-01-17T12:00:00Z');
      expect(isTodayInCadence('custom', 'UTC', customDays, wednesday)).toBe(true);
    });

    it('should throw error for custom cadence without daysOfWeek', () => {
      const monday = new Date('2024-01-15T12:00:00Z');
      expect(() => isTodayInCadence('custom', 'UTC', undefined, monday)).toThrow();
      expect(() => isTodayInCadence('custom', 'UTC', [], monday)).toThrow();
    });

    it('should handle timezone differences correctly', () => {
      const lateNightUTC = new Date('2024-01-15T23:00:00Z'); // Monday night
      
      expect(isTodayInCadence('weekdays', 'Asia/Tokyo', undefined, lateNightUTC)).toBe(true);
      
      expect(isTodayInCadence('weekdays', 'America/Los_Angeles', undefined, lateNightUTC)).toBe(true);
    });
  });

  describe('isValidCadenceConfig', () => {
    it('should validate daily cadence without daysOfWeek', () => {
      expect(isValidCadenceConfig('daily')).toBe(true);
      expect(isValidCadenceConfig('daily', undefined)).toBe(true);
    });

    it('should validate weekdays cadence without daysOfWeek', () => {
      expect(isValidCadenceConfig('weekdays')).toBe(true);
      expect(isValidCadenceConfig('weekdays', undefined)).toBe(true);
    });

    it('should validate weekends cadence without daysOfWeek', () => {
      expect(isValidCadenceConfig('weekends')).toBe(true);
      expect(isValidCadenceConfig('weekends', undefined)).toBe(true);
    });

    it('should validate custom cadence with valid daysOfWeek', () => {
      expect(isValidCadenceConfig('custom', [0, 1, 2])).toBe(true);
      expect(isValidCadenceConfig('custom', [1, 3, 5])).toBe(true);
      expect(isValidCadenceConfig('custom', [0, 6])).toBe(true);
    });

    it('should reject custom cadence without daysOfWeek', () => {
      expect(isValidCadenceConfig('custom')).toBe(false);
      expect(isValidCadenceConfig('custom', undefined)).toBe(false);
      expect(isValidCadenceConfig('custom', [])).toBe(false);
    });

    it('should reject custom cadence with invalid days', () => {
      expect(isValidCadenceConfig('custom', [-1, 0, 1])).toBe(false);
      expect(isValidCadenceConfig('custom', [0, 1, 7])).toBe(false);
      expect(isValidCadenceConfig('custom', [0, 1, 100])).toBe(false);
    });
  });

  describe('getCadenceDescription', () => {
    it('should return description for daily cadence', () => {
      expect(getCadenceDescription('daily')).toBe('Every day');
    });

    it('should return description for weekdays cadence', () => {
      expect(getCadenceDescription('weekdays')).toBe('Monday through Friday');
    });

    it('should return description for weekends cadence', () => {
      expect(getCadenceDescription('weekends')).toBe('Saturday and Sunday');
    });

    it('should return description for custom cadence with days', () => {
      expect(getCadenceDescription('custom', [1, 3, 5])).toBe('Monday, Wednesday, Friday');
      expect(getCadenceDescription('custom', [0, 6])).toBe('Sunday, Saturday');
      expect(getCadenceDescription('custom', [0, 1, 2, 3, 4, 5, 6])).toBe('Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday');
    });

    it('should return description for custom cadence without days', () => {
      expect(getCadenceDescription('custom')).toBe('Custom (not configured)');
      expect(getCadenceDescription('custom', [])).toBe('Custom (not configured)');
    });

    it('should sort days in custom cadence description', () => {
      expect(getCadenceDescription('custom', [5, 1, 3])).toBe('Monday, Wednesday, Friday');
      expect(getCadenceDescription('custom', [6, 0])).toBe('Sunday, Saturday');
    });
  });
});
