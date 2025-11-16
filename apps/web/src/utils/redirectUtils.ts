/**
 * Normalizes and validates a redirect path from query parameters.
 * Only allows relative paths starting with "/" and prevents protocol-relative
 * or absolute URLs to prevent open-redirect vulnerabilities.
 *
 * @param redirectPath - The redirect path from query parameters (can be null/undefined)
 * @param defaultPath - The default path to use if validation fails (defaults to "/dashboard")
 * @returns A safe relative path starting with "/"
 */
export function normalizeRedirectPath(
  redirectPath: string | null | undefined,
  defaultPath: string = '/dashboard'
): string {
  // If no redirect path provided, use default
  if (!redirectPath) {
    return defaultPath
  }

  // Must start with "/" to be a relative path
  if (!redirectPath.startsWith('/')) {
    return defaultPath
  }

  // Prevent protocol-relative URLs (e.g., "//evil.com")
  if (redirectPath.includes('//')) {
    return defaultPath
  }

  // Prevent Windows-style absolute paths (e.g., "C:\" or "C:/")
  if (redirectPath.includes(':\\') || redirectPath.match(/^\/[a-zA-Z]:/)) {
    return defaultPath
  }

  // Valid relative path
  return redirectPath
}
