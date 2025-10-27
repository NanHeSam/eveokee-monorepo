import { describe, it, expect } from 'vitest';
import {
  localTimeToUTC,
  getLocalDate,
  getLocalDayOfWeek,
  getUTCDayBounds,
  isValidE164,
  isValidTimeOfDay,
  isValidTimezone,
} from '../convex/timezoneHelpers';

describe('timezoneHelpers', () => {
  describe('isValidE164', () => {
    it('should validate correct E.164 phone numbers', () => {
      expect(isValidE164('+12125551234')).toBe(true);
      expect(isValidE164('+442071234567')).toBe(true);
      expect(isValidE164('+861234567890')).toBe(true);
    });

    it('should reject invalid E.164 phone numbers', () => {
      expect(isValidE164('12125551234')).toBe(false); // Missing +
      expect(isValidE164('+0123456789')).toBe(false); // Starts with 0
      expect(isValidE164('+1')).toBe(false); // Too short
      expect(isValidE164('+12345678901234567')).toBe(false); // Too long
      expect(isValidE164('abc')).toBe(false); // Not a number
    });
  });

  describe('isValidTimeOfDay', () => {
    it('should validate correct time formats', () => {
      expect(isValidTimeOfDay('00:00')).toBe(true);
      expect(isValidTimeOfDay('09:30')).toBe(true);
      expect(isValidTimeOfDay('12:00')).toBe(true);
      expect(isValidTimeOfDay('23:59')).toBe(true);
    });

    it('should reject invalid time formats', () => {
      expect(isValidTimeOfDay('24:00')).toBe(false); // Hour too high
      expect(isValidTimeOfDay('12:60')).toBe(false); // Minute too high
      expect(isValidTimeOfDay('9:30')).toBe(false); // Missing leading zero
      expect(isValidTimeOfDay('09:5')).toBe(false); // Missing trailing zero
      expect(isValidTimeOfDay('abc')).toBe(false); // Not a time
    });
  });

  describe('isValidTimezone', () => {
    it('should validate correct IANA timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
    });

    it('should reject invalid timezones', () => {
      expect(isValidTimezone('EST')).toBe(false); // Not IANA format
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('America/InvalidCity')).toBe(false);
    });
  });

  describe('localTimeToUTC', () => {
    it('should convert local time to UTC correctly', () => {
      const referenceDate = new Date('2024-01-15T12:00:00Z');
      
      const utc = localTimeToUTC('09:00', 'America/New_York', referenceDate);
      const utcDate = new Date(utc);
      expect(utcDate.getUTCHours()).toBe(14);
      expect(utcDate.getUTCMinutes()).toBe(0);
    });

    it('should handle DST transitions correctly', () => {
      const summerDate = new Date('2024-07-15T12:00:00Z');
      
      const utc = localTimeToUTC('09:00', 'America/New_York', summerDate);
      const utcDate = new Date(utc);
      expect(utcDate.getUTCHours()).toBe(13);
      expect(utcDate.getUTCMinutes()).toBe(0);
    });

    it('should throw error for invalid time format', () => {
      expect(() => localTimeToUTC('25:00', 'America/New_York')).toThrow();
      expect(() => localTimeToUTC('abc', 'America/New_York')).toThrow();
    });

    it('should throw error for invalid timezone', () => {
      expect(() => localTimeToUTC('09:00', 'Invalid/Timezone')).toThrow();
    });
  });

  describe('getLocalDayOfWeek', () => {
    it('should return correct day of week for timezone', () => {
      const monday = new Date('2024-01-15T12:00:00Z');
      expect(getLocalDayOfWeek('UTC', monday)).toBe(1);
      
      const sunday = new Date('2024-01-14T12:00:00Z');
      expect(getLocalDayOfWeek('UTC', sunday)).toBe(0);
      
      const saturday = new Date('2024-01-20T12:00:00Z');
      expect(getLocalDayOfWeek('UTC', saturday)).toBe(6);
    });

    it('should handle timezone differences correctly', () => {
      const lateNightUTC = new Date('2024-01-15T23:00:00Z');
      
      const tokyoDay = getLocalDayOfWeek('Asia/Tokyo', lateNightUTC);
      const utcDay = getLocalDayOfWeek('UTC', lateNightUTC);
      
      expect((tokyoDay + 6) % 7).toBe(utcDay);
    });
  });

  describe('getUTCDayBounds', () => {
    it('should return start and end of day in UTC', () => {
      const referenceDate = new Date('2024-01-15T12:00:00Z');
      const bounds = getUTCDayBounds('UTC', referenceDate);
      
      const startDate = new Date(bounds.startOfDay);
      const endDate = new Date(bounds.endOfDay);
      
      expect(startDate.getUTCHours()).toBe(0);
      expect(startDate.getUTCMinutes()).toBe(0);
      expect(endDate.getUTCHours()).toBe(23);
      expect(endDate.getUTCMinutes()).toBe(59);
    });

    it('should handle timezone offsets correctly', () => {
      const referenceDate = new Date('2024-01-15T12:00:00Z');
      const bounds = getUTCDayBounds('America/New_York', referenceDate);
      
      expect(bounds.endOfDay).toBeGreaterThan(bounds.startOfDay);
      
      const duration = bounds.endOfDay - bounds.startOfDay;
      expect(duration).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(duration).toBeLessThan(25 * 60 * 60 * 1000);
    });
  });
});
