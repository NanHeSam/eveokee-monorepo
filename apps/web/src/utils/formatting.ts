/**
 * Shared formatting utilities for consistent formatting across the app
 */

/**
 * Format duration in seconds to MM:SS format
 * @param seconds - Duration in seconds (optional)
 * @returns Formatted duration string (e.g., "3:45")
 */
export function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Alias for formatDuration to maintain compatibility with existing code
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "3:45")
 */
export function formatTime(seconds: number): string {
  return formatDuration(seconds);
}

/**
 * Format timestamp to localized date string
 * @param timestamp - Unix timestamp in milliseconds
 * @param options - Intl.DateTimeFormatOptions for customizing the output
 * @param locale - Locale string (default: 'en-US')
 * @returns Formatted date string
 */
export function formatDate(
  timestamp: number,
  options?: Intl.DateTimeFormatOptions,
  locale: string = 'en-US'
): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale, options);
}

/**
 * Truncate text to a maximum length and add ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation (default: 120)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 120): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
