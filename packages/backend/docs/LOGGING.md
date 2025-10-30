# Production Logging Guide

**Version**: 1.0
**Last Updated**: 2025-10-28
**Status**: Active

---

## Overview

This document describes the structured logging system implemented in the Convex backend. The system provides production-ready logging with correlation IDs, context enrichment, and performance tracking.

---

## Features

### ✅ Core Capabilities

- **Structured JSON Logging**: All logs are JSON-formatted for easy parsing
- **Log Levels**: debug, info, warn, error
- **Correlation IDs**: Track requests across function boundaries
- **Context Enrichment**: Automatic userId, functionName, metadata
- **Performance Timing**: Built-in duration tracking
- **Error Serialization**: Full stack traces and error details
- **PII Protection**: Sanitization helpers for sensitive data

---

## Quick Start

### Basic Usage

```typescript
import { createLogger } from "./utils/logger";

export const myFunction = internalMutation({
  handler: async (ctx, args) => {
    // Create logger with context
    const logger = createLogger({
      functionName: 'myFunction',
      userId: args.userId,
    });

    logger.info('Function started');

    try {
      // Your code here
      logger.debug('Processing data', { recordCount: 10 });

      // Success
      logger.info('Function completed successfully');
    } catch (error) {
      logger.error('Function failed', error, {
        attemptedOperation: 'data processing',
      });
      throw error;
    }
  },
});
```

### With Correlation IDs

```typescript
import { createLogger, generateCorrelationId } from "./utils/logger";

export const myAction = internalAction({
  handler: async (ctx) => {
    const correlationId = generateCorrelationId();
    const logger = createLogger({
      functionName: 'myAction',
      correlationId,
    });

    logger.info('Action started');

    // Call mutation with same correlation ID
    const result = await ctx.runMutation(internal.myModule.myMutation, {
      correlationId, // Pass to child function
    });

    logger.info('Action completed', { result });
  },
});
```

### With Performance Timing

```typescript
const logger = createLogger({ functionName: 'expensiveOperation' });

logger.startTimer();

// Do expensive work
await someSlowOperation();

// Duration automatically included in next log
logger.info('Operation completed');
// Output includes: "duration": 1250 (ms)
```

### Child Loggers

```typescript
const parentLogger = createLogger({ userId: 'abc123' });

// Child logger inherits parent context
const childLogger = parentLogger.child({
  subscriptionId: 'sub_456',
});

childLogger.info('Processing subscription');
// Output includes both userId AND subscriptionId
```

---

## API Reference

### `createLogger(context?: LogContext): Logger`

Create a new logger instance with optional initial context.

**Parameters:**
- `context` - Optional context object with keys like userId, functionName, etc.

**Returns:** `Logger` instance

**Example:**
```typescript
const logger = createLogger({
  functionName: 'processPayment',
  userId: user._id,
});
```

---

### `Logger` Class Methods

#### `logger.debug(message: string, metadata?: Record<string, unknown>)`

Log at debug level (for development/troubleshooting).

```typescript
logger.debug('Cache hit', { cacheKey: 'user:123', ttl: 3600 });
```

#### `logger.info(message: string, metadata?: Record<string, unknown>)`

Log at info level (for normal operations).

```typescript
logger.info('User subscription updated', {
  tier: 'premium',
  status: 'active',
});
```

#### `logger.warn(message: string, metadata?: Record<string, unknown>)`

Log at warning level (for potential issues).

```typescript
logger.warn('Rate limit approaching', {
  currentUsage: 95,
  limit: 100,
});
```

#### `logger.error(message: string, error?: Error, metadata?: Record<string, unknown>)`

Log at error level (for failures).

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error, {
    attemptedAction: 'database write',
    retryCount: 3,
  });
}
```

#### `logger.child(additionalContext: LogContext): Logger`

Create a child logger with additional context.

```typescript
const parentLogger = createLogger({ userId: 'user_123' });
const childLogger = parentLogger.child({ operationId: 'op_456' });

childLogger.info('Processing');
// Includes both userId and operationId
```

#### `logger.startTimer(): void`

Start a performance timer. Next log will include duration in milliseconds.

```typescript
logger.startTimer();
await expensiveOperation();
logger.info('Completed'); // Includes duration
```

---

### Helper Functions

#### `generateCorrelationId(): string`

Generate a unique correlation ID for request tracing.

```typescript
const correlationId = generateCorrelationId();
// Returns: "1730123456789-abc123xyz"
```

#### `sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown>`

Remove sensitive data (passwords, tokens, secrets) from objects before logging.

```typescript
const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123',
  apiKey: 'sk_live_abc123',
};

const safe = sanitizeForLogging(userData);
// { name: 'John Doe', email: 'john@example.com', password: '***REDACTED***', apiKey: '***REDACTED***' }
```

#### `logReconciliation(logger, userId, oldStatus, newStatus, metadata?)`

Log a subscription reconciliation event with standard format.

```typescript
logReconciliation(logger, user._id, 'active', 'expired', {
  reason: 'subscription ended',
});
```

---

## Log Structure

### Output Format

All logs are output as JSON with the following structure:

```typescript
{
  "timestamp": "2025-10-28T12:34:56.789Z",  // ISO 8601
  "level": "info",                           // debug | info | warn | error
  "message": "Webhook processed successfully",
  "context": {                               // Optional: logger context
    "functionName": "revenueCatWebhookHandler",
    "correlationId": "1730123456789-abc123",
    "userId": "jh73k2n9x8p5q6r7",
    "eventType": "INITIAL_PURCHASE"
  },
  "duration": 245,                           // Optional: ms since startTimer()
  "metadata": {                              // Optional: additional data
    "status": "success",
    "recordsProcessed": 10
  },
  "error": {                                 // Optional: if error logged
    "message": "Network timeout",
    "name": "TimeoutError",
    "stack": "Error: Network timeout\n  at ...",
    "code": "ETIMEDOUT"
  }
}
```

---

## Best Practices

### 1. Always Use Correlation IDs in Actions

Actions that call mutations should generate a correlation ID and pass it through:

```typescript
// ✅ Good
export const myAction = internalAction({
  handler: async (ctx) => {
    const correlationId = generateCorrelationId();
    const logger = createLogger({ functionName: 'myAction', correlationId });

    const result = await ctx.runMutation(internal.myModule.myMutation, {
      correlationId,  // Pass to child
    });
  },
});

// ❌ Bad - no correlation ID
export const myAction = internalAction({
  handler: async (ctx) => {
    const logger = createLogger({ functionName: 'myAction' });
    // Hard to trace calls across functions
  },
});
```

### 2. Use Child Loggers for Context Inheritance

```typescript
// ✅ Good
const baseLogger = createLogger({ userId: user._id });

for (const subscription of subscriptions) {
  const subLogger = baseLogger.child({ subscriptionId: subscription._id });
  subLogger.info('Processing subscription');
  // Includes both userId and subscriptionId
}

// ❌ Bad - manual context duplication
for (const subscription of subscriptions) {
  logger.info('Processing subscription', {
    userId: user._id,  // Repeated in every log
    subscriptionId: subscription._id,
  });
}
```

### 3. Log at Appropriate Levels

| Level   | Use For                                          | Example                                    |
|---------|--------------------------------------------------|--------------------------------------------|
| debug   | Development details, cache hits, validation      | `logger.debug('Cache hit', { key })`       |
| info    | Normal operations, state changes                 | `logger.info('User created')`              |
| warn    | Potential issues, degraded performance           | `logger.warn('Rate limit approaching')`    |
| error   | Failures, exceptions, errors                     | `logger.error('Payment failed', error)`    |

### 4. Include Rich Metadata

```typescript
// ✅ Good - rich context
logger.info('Subscription updated', {
  oldTier: 'free',
  newTier: 'premium',
  userId: user._id,
  paymentMethod: 'stripe',
  amount: 9.99,
});

// ❌ Bad - minimal context
logger.info('Subscription updated');
```

### 5. Always Log Errors with Stack Traces

```typescript
// ✅ Good
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error, {
    context: 'additional info',
  });
  throw error;
}

// ❌ Bad - error details lost
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed');  // No stack trace!
  throw error;
}
```

### 6. Use Performance Timing for Slow Operations

```typescript
// ✅ Good
logger.startTimer();
const result = await expensiveQuery();
logger.info('Query completed', { rowCount: result.length });
// Includes duration automatically

// ❌ Bad - no performance visibility
const result = await expensiveQuery();
logger.info('Query completed');
```

### 7. Sanitize Sensitive Data

```typescript
// ✅ Good
const userData = sanitizeForLogging({
  email: user.email,
  password: user.password,  // Will be redacted
  apiKey: user.apiKey,      // Will be redacted
});
logger.info('User data', userData);

// ❌ Bad - logs sensitive data
logger.info('User data', {
  email: user.email,
  password: user.password,  // 🚨 SECURITY ISSUE
});
```

---

## Common Patterns

### Pattern 1: Webhook Handler

```typescript
const revenueCatWebhookHandler = httpAction(async (ctx, req) => {
  const correlationId = generateCorrelationId();
  const logger = createLogger({
    functionName: 'revenueCatWebhookHandler',
    correlationId,
  });

  logger.startTimer();
  logger.info('Webhook received');

  // Validate & parse
  const eventLogger = logger.child({
    eventType: event.type,
    userId: event.app_user_id,
  });

  eventLogger.info('Webhook validated');

  try {
    await ctx.runMutation(internal.billing.processWebhook, {
      correlationId,
      data: event,
    });
    eventLogger.info('Webhook processed successfully');
  } catch (error) {
    eventLogger.error('Webhook processing failed', error);
    throw error;
  }
});
```

### Pattern 2: Cron Job

```typescript
export const dailyReconciliation = internalAction({
  handler: async (ctx) => {
    const correlationId = generateCorrelationId();
    const logger = createLogger({
      functionName: 'dailyReconciliation',
      correlationId,
    });

    logger.startTimer();
    logger.info('Reconciliation started');

    let processed = 0;
    let errors = 0;

    for (const item of items) {
      const itemLogger = logger.child({ itemId: item._id });

      try {
        await processItem(item);
        processed++;
        itemLogger.debug('Item processed');
      } catch (error) {
        errors++;
        itemLogger.error('Item failed', error);
      }
    }

    logger.info('Reconciliation completed', {
      total: items.length,
      processed,
      errors,
      successRate: ((processed / items.length) * 100).toFixed(2) + '%',
    });
  },
});
```

### Pattern 3: Multi-Step Operation

```typescript
export const complexOperation = internalMutation({
  handler: async (ctx, args) => {
    const logger = createLogger({
      functionName: 'complexOperation',
      userId: args.userId,
      correlationId: args.correlationId,
    });

    logger.startTimer();

    // Step 1
    logger.info('Step 1: Validating input');
    const validation = await validateInput(args);
    logger.debug('Validation complete', { valid: validation.success });

    // Step 2
    logger.info('Step 2: Fetching data');
    const data = await ctx.db.query(...);
    logger.debug('Data fetched', { recordCount: data.length });

    // Step 3
    logger.info('Step 3: Processing');
    const result = await process(data);
    logger.info('Processing complete', { itemsProcessed: result.count });

    return result;
  },
});
```

---

## Querying Logs

### In Convex Dashboard

1. Open Convex Dashboard → Logs
2. Use filters to find logs:
   - Filter by level: `level:error`
   - Filter by correlation ID: `correlationId:1730123456789-abc123`
   - Filter by user: `userId:jh73k2n9x8p5q6r7`

### With Log Analysis Tools

Since logs are JSON, they can be easily parsed by tools like:

- **Datadog**: Parse JSON, index by correlation ID
- **New Relic**: Use log forwarding, search by userId
- **CloudWatch Insights**: Query with JSON path expressions
- **Elastic/Kibana**: Index structured fields

Example Elasticsearch query:
```json
{
  "query": {
    "bool": {
      "must": [
        { "term": { "level": "error" } },
        { "range": { "timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

---

## Migration Guide

### Replacing console.log

```typescript
// Before
console.log('User created:', userId);
console.error('Failed to create user:', error);

// After
const logger = createLogger({ functionName: 'createUser' });
logger.info('User created', { userId });
logger.error('Failed to create user', error, { userId });
```

### Replacing console.warn

```typescript
// Before
console.warn('Rate limit approaching', currentUsage, limit);

// After
logger.warn('Rate limit approaching', {
  currentUsage,
  limit,
  percentUsed: (currentUsage / limit * 100).toFixed(2) + '%',
});
```

---

## Troubleshooting

### Issue: Logs not appearing in dashboard

**Solution**: Check log level. Debug logs may be filtered out in production.

### Issue: Correlation ID not propagating

**Solution**: Ensure you pass `correlationId` as argument to mutations/queries:

```typescript
await ctx.runMutation(internal.myModule.myMutation, {
  correlationId: args.correlationId,  // Must pass explicitly
});
```

### Issue: Too much log volume

**Solution**: Use appropriate log levels:
- Use `debug` for verbose logging (filtered in production)
- Use `info` for normal operations
- Use `warn` and `error` sparingly

### Issue: Sensitive data in logs

**Solution**: Use `sanitizeForLogging()` before logging user data:

```typescript
const safeData = sanitizeForLogging(userData);
logger.info('User data', safeData);
```

---

## Performance Considerations

- **JSON serialization**: Minimal overhead (~1ms per log)
- **Correlation IDs**: No performance impact, improves debugging
- **Child loggers**: Lightweight, only shallow context copy
- **Timer**: Uses `Date.now()`, negligible overhead

**Recommendation**: Use liberally. Benefits far outweigh costs.

---

## Future Enhancements

Potential improvements for v2.0:

- [ ] Automatic sampling (log 1% of requests at debug level)
- [ ] Log aggregation and metrics
- [ ] Custom log formatters per environment
- [ ] Log streaming to external services
- [ ] Trace IDs for distributed tracing
- [ ] Span IDs for OpenTelemetry integration

---

## Examples

See real-world implementations:
- [http.ts](../convex/http.ts) - Webhook handler with correlation IDs
- [revenueCatBilling.ts](../convex/revenueCatBilling.ts) - Reconciliation with child loggers
- [usage.ts](../convex/usage.ts) - Usage tracking (to be migrated)

---

## Support

For questions or issues:
1. Check this documentation
2. Review example implementations
3. Open GitHub issue
4. Contact backend team

---

**Last Updated**: 2025-10-28
**Maintained By**: Backend Team
**Version**: 1.0
