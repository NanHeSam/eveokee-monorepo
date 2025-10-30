/**
 * Phone number validation utilities
 */

/**
 * Checks whether a phone number conforms to the E.164 format.
 *
 * @param phone - The phone number to validate (for example, '+15551234567')
 * @returns `true` if the phone number matches E.164 format, `false` otherwise.
 */
export function isValidE164(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

