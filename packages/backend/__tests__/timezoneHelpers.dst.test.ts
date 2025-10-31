import { describe, it, expect } from 'vitest';
import { localTimeToUTC, getLocalDayOfWeek } from '../convex/utils/timezoneHelpers';

describe('timezoneHelpers - DST Boundary Cases', () => {
  describe('Spring Forward (DST begins)', () => {
    it('should handle US spring forward correctly (2024-03-10)', () => {
      
      const beforeDST = new Date('2024-03-09T12:00:00Z');
      const utcBefore = localTimeToUTC('09:00', 'America/New_York', beforeDST);
      const dateBefore = new Date(utcBefore);
      expect(dateBefore.getUTCHours()).toBe(14); // 09:00 EST = 14:00 UTC
      
      const afterDST = new Date('2024-03-11T12:00:00Z');
      const utcAfter = localTimeToUTC('09:00', 'America/New_York', afterDST);
      const dateAfter = new Date(utcAfter);
      expect(dateAfter.getUTCHours()).toBe(13); // 09:00 EDT = 13:00 UTC
    });

    it('should handle Europe spring forward correctly (2024-03-31)', () => {
      
      const beforeDST = new Date('2024-03-30T12:00:00Z');
      const utcBefore = localTimeToUTC('09:00', 'Europe/London', beforeDST);
      const dateBefore = new Date(utcBefore);
      expect(dateBefore.getUTCHours()).toBe(9); // 09:00 GMT = 09:00 UTC
      
      const afterDST = new Date('2024-04-01T12:00:00Z');
      const utcAfter = localTimeToUTC('09:00', 'Europe/London', afterDST);
      const dateAfter = new Date(utcAfter);
      expect(dateAfter.getUTCHours()).toBe(8); // 09:00 BST = 08:00 UTC
    });

    it('should handle Australia spring forward correctly (2024-10-06)', () => {
      
      const beforeDST = new Date('2024-10-05T12:00:00Z');
      const utcBefore = localTimeToUTC('09:00', 'Australia/Sydney', beforeDST);
      const dateBefore = new Date(utcBefore);
      expect(dateBefore.getUTCHours()).toBe(23); // Previous day 23:00 UTC
      
      const afterDST = new Date('2024-10-07T12:00:00Z');
      const utcAfter = localTimeToUTC('09:00', 'Australia/Sydney', afterDST);
      const dateAfter = new Date(utcAfter);
      expect(dateAfter.getUTCHours()).toBe(22); // Previous day 22:00 UTC
    });
  });

  describe('Fall Back (DST ends)', () => {
    it('should handle US fall back correctly (2024-11-03)', () => {
      
      const beforeDST = new Date('2024-11-02T12:00:00Z');
      const utcBefore = localTimeToUTC('09:00', 'America/New_York', beforeDST);
      const dateBefore = new Date(utcBefore);
      expect(dateBefore.getUTCHours()).toBe(13); // 09:00 EDT = 13:00 UTC
      
      const afterDST = new Date('2024-11-04T12:00:00Z');
      const utcAfter = localTimeToUTC('09:00', 'America/New_York', afterDST);
      const dateAfter = new Date(utcAfter);
      expect(dateAfter.getUTCHours()).toBe(14); // 09:00 EST = 14:00 UTC
    });

    it('should handle Europe fall back correctly (2024-10-27)', () => {
      
      const beforeDST = new Date('2024-10-26T12:00:00Z');
      const utcBefore = localTimeToUTC('09:00', 'Europe/London', beforeDST);
      const dateBefore = new Date(utcBefore);
      expect(dateBefore.getUTCHours()).toBe(8); // 09:00 BST = 08:00 UTC
      
      const afterDST = new Date('2024-10-28T12:00:00Z');
      const utcAfter = localTimeToUTC('09:00', 'Europe/London', afterDST);
      const dateAfter = new Date(utcAfter);
      expect(dateAfter.getUTCHours()).toBe(9); // 09:00 GMT = 09:00 UTC
    });

    it('should handle Australia fall back correctly (2024-04-07)', () => {
      
      const beforeDST = new Date('2024-04-06T12:00:00Z');
      const utcBefore = localTimeToUTC('09:00', 'Australia/Sydney', beforeDST);
      const dateBefore = new Date(utcBefore);
      expect(dateBefore.getUTCHours()).toBe(22); // Previous day 22:00 UTC
      
      const afterDST = new Date('2024-04-08T12:00:00Z');
      const utcAfter = localTimeToUTC('09:00', 'Australia/Sydney', afterDST);
      const dateAfter = new Date(utcAfter);
      expect(dateAfter.getUTCHours()).toBe(23); // Previous day 23:00 UTC
    });
  });

  describe('Day of Week during DST transitions', () => {
    it('should correctly identify day of week during spring forward', () => {
      const dstDay = new Date('2024-03-10T12:00:00Z');
      expect(getLocalDayOfWeek('America/New_York', dstDay)).toBe(0);
      
      const dayBefore = new Date('2024-03-09T12:00:00Z');
      expect(getLocalDayOfWeek('America/New_York', dayBefore)).toBe(6); // Saturday
      
      const dayAfter = new Date('2024-03-11T12:00:00Z');
      expect(getLocalDayOfWeek('America/New_York', dayAfter)).toBe(1); // Monday
    });

    it('should correctly identify day of week during fall back', () => {
      const dstDay = new Date('2024-11-03T12:00:00Z');
      expect(getLocalDayOfWeek('America/New_York', dstDay)).toBe(0);
      
      const dayBefore = new Date('2024-11-02T12:00:00Z');
      expect(getLocalDayOfWeek('America/New_York', dayBefore)).toBe(6); // Saturday
      
      const dayAfter = new Date('2024-11-04T12:00:00Z');
      expect(getLocalDayOfWeek('America/New_York', dayAfter)).toBe(1); // Monday
    });

    it('should handle timezone date boundary during DST transition', () => {
      const lateNight = new Date('2024-03-10T23:00:00Z');
      
      expect(getLocalDayOfWeek('America/New_York', lateNight)).toBe(0);
      
      expect(getLocalDayOfWeek('Asia/Tokyo', lateNight)).toBe(1);
    });
  });

  describe('Edge cases around DST transitions', () => {
    it('should handle scheduling during the "lost hour" in spring forward', () => {
      const dstDay = new Date('2024-03-10T12:00:00Z');
      
      expect(() => localTimeToUTC('02:30', 'America/New_York', dstDay)).not.toThrow();
    });

    it('should handle scheduling during the "repeated hour" in fall back', () => {
      const dstDay = new Date('2024-11-03T12:00:00Z');
      
      expect(() => localTimeToUTC('01:30', 'America/New_York', dstDay)).not.toThrow();
    });

    it('should handle timezones that do not observe DST', () => {
      const winter = new Date('2024-01-15T12:00:00Z');
      const summer = new Date('2024-07-15T12:00:00Z');
      
      const winterUtc = localTimeToUTC('09:00', 'America/Phoenix', winter);
      const summerUtc = localTimeToUTC('09:00', 'America/Phoenix', summer);
      
      const winterDate = new Date(winterUtc);
      const summerDate = new Date(summerUtc);
      
      expect(winterDate.getUTCHours()).toBe(16);
      expect(summerDate.getUTCHours()).toBe(16);
    });

    it('should handle Southern Hemisphere DST (opposite of Northern)', () => {
      
      const australianSummer = new Date('2024-01-15T12:00:00Z');
      const summerUtc = localTimeToUTC('09:00', 'Australia/Sydney', australianSummer);
      const summerDate = new Date(summerUtc);
      expect(summerDate.getUTCHours()).toBe(22); // Previous day 22:00 UTC
      
      const australianWinter = new Date('2024-07-15T12:00:00Z');
      const winterUtc = localTimeToUTC('09:00', 'Australia/Sydney', australianWinter);
      const winterDate = new Date(winterUtc);
      expect(winterDate.getUTCHours()).toBe(23); // Previous day 23:00 UTC
    });
  });

  describe('Multiple DST transitions in a year', () => {
    it('should handle multiple transitions correctly throughout the year', () => {
      const testDates = [
        { date: new Date('2024-01-15T12:00:00Z'), expectedHour: 14, season: 'winter' },
        { date: new Date('2024-03-09T12:00:00Z'), expectedHour: 14, season: 'before spring DST' },
        { date: new Date('2024-03-11T12:00:00Z'), expectedHour: 13, season: 'after spring DST' },
        { date: new Date('2024-07-15T12:00:00Z'), expectedHour: 13, season: 'summer' },
        { date: new Date('2024-11-02T12:00:00Z'), expectedHour: 13, season: 'before fall DST' },
        { date: new Date('2024-11-04T12:00:00Z'), expectedHour: 14, season: 'after fall DST' },
        { date: new Date('2024-12-15T12:00:00Z'), expectedHour: 14, season: 'winter again' },
      ];
      
      testDates.forEach(({ date, expectedHour, season }) => {
        const utc = localTimeToUTC('09:00', 'America/New_York', date);
        const utcDate = new Date(utc);
        expect(utcDate.getUTCHours()).toBe(expectedHour);
      });
    });
  });
});
