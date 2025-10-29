import { describe, it, expect } from 'vitest';
import { isValidE164 } from '../convex/phoneHelpers';

describe('phoneHelpers', () => {
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
});

