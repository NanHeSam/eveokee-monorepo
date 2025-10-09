import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as Sentry from "@sentry/react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Basic email validation that requires a dot in the domain part
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return false;
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!local || !domain) return false;
  if (!domain.includes('.')) return false; // enforce dot in domain
  const labels = domain.split('.');
  // no empty labels and each label has at least 1 char
  if (labels.some(l => l.length === 0)) return false;
  return true;
}

// Capture exceptions with optional context
export function captureError(error: unknown, context?: Record<string, unknown>) {
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined)
  } catch {
    // no-op if Sentry is not initialized
  }
}
