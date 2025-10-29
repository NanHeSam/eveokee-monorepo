/**
 * Production-ready structured logging utility for Convex
 *
 * Features:
 * - Structured JSON logging for easy parsing
 * - Log levels (debug, info, warn, error)
 * - Correlation IDs for request tracing
 * - Context enrichment (userId, functionName, etc.)
 * - Performance timing
 * - Error serialization with stack traces
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  functionName?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
    code?: string | number;
  };
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Structured logger class with context support
 */
export class Logger {
  private context: LogContext;
  private startTime?: number;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Start a timer for performance measurement
   */
  startTimer(): void {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time since startTimer was called
   */
  private getElapsedTime(): number | undefined {
    return this.startTime ? Date.now() - this.startTime : undefined;
  }

  /**
   * Log at debug level
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, undefined, metadata);
  }

  /**
   * Log at info level
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, undefined, metadata);
  }

  /**
   * Log at warn level
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, undefined, metadata);
  }

  /**
   * Log at error level
   */
  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    this.log('error', message, error, metadata);
  }

  /**
   * Core logging function
   */
  private log(
    level: LogLevel,
    message: string,
    error?: Error | unknown,
    metadata?: Record<string, unknown>
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: Object.keys(this.context).length > 0 ? this.context : undefined,
      duration: this.getElapsedTime(),
      metadata,
    };

    // Serialize error if present
    if (error) {
      if (error instanceof Error) {
        logEntry.error = {
          message: error.message,
          name: error.name,
          stack: error.stack,
          code: (error as any).code,
        };
      } else {
        logEntry.error = {
          message: String(error),
        };
      }
    }

    // Output based on level (in production, these go to Convex logs)
    const logString = JSON.stringify(logEntry);

    switch (level) {
      case 'debug':
      case 'info':
        console.log(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'error':
        console.error(logString);
        break;
    }
  }
}

/**
 * Create a logger with initial context
 */
export function createLogger(context: LogContext = {}): Logger {
  return new Logger(context);
}

/**
 * Generate a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Extract user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Sanitize sensitive data from logs (for PII protection)
 */
export function sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));

    if (isSensitive) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Log a webhook event with standard fields
 */
export function logWebhookEvent(
  logger: Logger,
  eventType: string,
  status: 'received' | 'processed' | 'failed',
  metadata?: Record<string, unknown>
): void {
  const message = `Webhook ${status}: ${eventType}`;

  if (status === 'failed') {
    logger.error(message, undefined, metadata);
  } else {
    logger.info(message, metadata);
  }
}

/**
 * Log a reconciliation event with standard fields
 */
export function logReconciliation(
  logger: Logger,
  userId: string,
  oldStatus: string,
  newStatus: string,
  metadata?: Record<string, unknown>
): void {
  logger.info('Subscription reconciled', {
    userId,
    oldStatus,
    newStatus,
    changed: oldStatus !== newStatus,
    ...metadata,
  });
}

/**
 * Log a mutation/query execution with timing
 */
export function logFunctionExecution(
  logger: Logger,
  functionName: string,
  success: boolean,
  metadata?: Record<string, unknown>
): void {
  const duration = logger['getElapsedTime']?.() ?? 0;

  if (success) {
    logger.info(`Function executed: ${functionName}`, {
      functionName,
      duration,
      success,
      ...metadata,
    });
  } else {
    logger.error(`Function failed: ${functionName}`, undefined, {
      functionName,
      duration,
      success,
      ...metadata,
    });
  }
}
