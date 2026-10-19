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
    // Redact user content at the boundary so a careless call site cannot
    // write diary text, lyrics, prompts or highlights to the logs.
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: Object.keys(this.context).length > 0 ? redactUserContent(this.context) : undefined,
      duration: this.getElapsedTime(),
      metadata: metadata ? redactUserContent(metadata) : undefined,
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
 * AI SDK errors whose message embeds the model input or output (e.g.
 * "JSON parsing failed: Text: ..." or "Type validation failed: Value: ...").
 */
const CONTENT_BEARING_ERROR_NAMES = new Set([
  'AI_JSONParseError',
  'AI_TypeValidationError',
  'AI_InvalidResponseDataError',
  'AI_NoObjectGeneratedError',
  'AI_APICallError',
]);

/**
 * Error description that is safe to log or rethrow from code handling user
 * content: keeps the error name and provider status, drops messages known to
 * echo the prompt or the generated text, and caps the length of the rest.
 */
export function describeErrorForLog(error: unknown): string {
  if (!(error instanceof Error)) {
    return typeof error === 'string' ? '[non-Error thrown]' : 'Unknown error';
  }
  const status = (error as { statusCode?: unknown }).statusCode;
  const statusPart = typeof status === 'number' ? ` (status ${status})` : '';
  if (CONTENT_BEARING_ERROR_NAMES.has(error.name)) {
    return `${error.name}${statusPart}`;
  }
  const message = error.message.length > 300 ? `${error.message.slice(0, 300)}…` : error.message;
  return `${error.name}${statusPart}: ${message}`;
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
 * Keys whose values are (or are derived from) private user content: diary
 * text, call transcripts, generated lyrics, AI prompts built from them,
 * extracted events and people, relationship highlights, and raw provider
 * payloads that echo any of these back. Matched case-insensitively against
 * the exact key name.
 */
export const USER_CONTENT_KEYS: ReadonlySet<string> = new Set([
  "content",
  "text",
  "diary",
  "diarycontent",
  "diaryentry",
  "diarytext",
  "transcript",
  "transcripttext",
  "summary",
  "lyric",
  "lyrics",
  "prompt",
  "systemprompt",
  "promptpreview",
  "scriptprompt",
  "script",
  "videoscript",
  "highlight",
  "highlightpreview",
  "title",
  "songdata",
  "events",
  "people",
  "personname",
  "messages",
  "payload",
  "body",
  "request",
  "param",
]);

function describeRedacted(value: unknown): string {
  if (typeof value === "string") return `[redacted ${value.length} chars]`;
  if (Array.isArray(value)) return `[redacted array(${value.length})]`;
  if (value && typeof value === "object") return "[redacted object]";
  return "[redacted]";
}

/**
 * Return a copy of `data` with user content replaced by a size marker, so
 * logs keep IDs and counts but never the content itself. Recurses into
 * nested objects and arrays.
 */
export function redactUserContent<T>(data: T): T {
  const visit = (value: unknown, depth: number): unknown => {
    if (depth > 8 || value === null || typeof value !== "object") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => visit(item, depth + 1));
    }
    if (value instanceof Error) {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (inner !== undefined && inner !== null && USER_CONTENT_KEYS.has(key.toLowerCase())) {
        out[key] = describeRedacted(inner);
      } else {
        out[key] = visit(inner, depth + 1);
      }
    }
    return out;
  };
  return visit(data, 0) as T;
}

/**
 * Sanitize object for Convex storage by removing/renaming invalid field names
 * Convex doesn't allow field names starting with '$' or '_' (reserved)
 */
export function sanitizeForConvex(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeForConvex(item));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      // Remove/rename fields starting with $ or _ (Convex reserved characters)
      if (key.startsWith('$') || key.startsWith('_')) {
        // Rename by prefixing with 'x_' to preserve the data
        const newKey = `x_${key}`;
        sanitized[newKey] = sanitizeForConvex(value);
      } else {
        sanitized[key] = sanitizeForConvex(value);
      }
    }

    return sanitized;
  }

  return data;
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

