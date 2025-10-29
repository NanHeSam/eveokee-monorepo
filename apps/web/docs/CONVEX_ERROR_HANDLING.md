# Convex Error Handling Guide

This document outlines how we handle errors in the Eveokee app, following Convex's best practices.

## Architecture Overview

### 1. **Top-Level Error Boundary** (main.tsx)
- **Sentry.ErrorBoundary** wraps the entire app
- Catches all React errors including Convex query errors
- Automatically reports errors to Sentry for monitoring
- Shows a user-friendly `ErrorFallback` component

### 2. **Loading State Management** (ConvexQueryBoundary)
- Handles loading states for multiple queries
- Provides consistent loading UI across the app
- Can be customized per component

### 3. **Backend Error Throwing** (Convex functions)
- Use `ConvexError` for application-level errors
- Queries throw errors that are caught by Error Boundary
- Mutations reject promises that can be caught with try/catch

## Implementation

### Frontend: Using ConvexQueryBoundary

```tsx
import { useQuery } from 'convex/react';
import { api } from '@backend/convex';
import ConvexQueryBoundary from '@/components/ConvexQueryBoundary';

function MyComponent() {
  const data1 = useQuery(api.example.getData1);
  const data2 = useQuery(api.example.getData2);

  return (
    <ConvexQueryBoundary 
      queries={[
        { data: data1 },
        { data: data2 },
      ]}
      loadingFallback={<div>Loading...</div>}
    >
      {/* Component content - will only render when all queries are loaded */}
      <div>{data1.name}</div>
      <div>{data2.title}</div>
    </ConvexQueryBoundary>
  );
}
```

### Backend: Throwing ConvexError

```typescript
import { ConvexError } from "convex/values";
import { query } from "./_generated/server";

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      // This will be caught by the Error Boundary
      throw new ConvexError("User not found");
    }
    
    return user;
  },
});
```

### Handling Mutation Errors

```tsx
import { useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { ConvexError } from 'convex/values';
import toast from 'react-hot-toast';

function MyForm() {
  const doSomething = useMutation(api.myFunctions.mutateSomething);

  const handleSubmit = async (formData) => {
    try {
      await doSomething(formData);
      toast.success('Success!');
    } catch (error) {
      const errorMessage =
        error instanceof ConvexError
          ? error.data
          : "Unexpected error occurred";
      toast.error(errorMessage);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## Error Types

### 1. Query Errors
- **Symptom**: Query stays `undefined` or throws error
- **Handled by**: Sentry Error Boundary (automatically)
- **User sees**: ErrorFallback component with "Try Again" button
- **Logged to**: Sentry (automatic)

### 2. Mutation Errors
- **Symptom**: Promise rejection
- **Handled by**: try/catch in component
- **User sees**: Toast notification with error message
- **Logged to**: Sentry (if error thrown in catch block)

### 3. Loading States
- **Symptom**: Query returns `undefined`
- **Handled by**: ConvexQueryBoundary or manual checks
- **User sees**: Loading spinner or skeleton
- **Not an error**: Normal behavior

## Best Practices

### ✅ DO
- Wrap multiple queries with `ConvexQueryBoundary`
- Throw `ConvexError` from backend for application errors
- Use try/catch for mutations
- Keep Sentry Error Boundary at top level
- Show user-friendly error messages

### ❌ DON'T
- Don't nest multiple Error Boundaries unless needed
- Don't throw generic `Error` - use `ConvexError` instead
- Don't ignore mutation errors
- Don't show technical error messages to end users
- Don't handle loading states inconsistently

## Testing Error Handling

### Test Query Errors
```tsx
// In your test
vi.mocked(useQuery).mockImplementation(() => {
  throw new Error('Test error');
});

// Error Boundary should catch it and show ErrorFallback
```

### Test Loading States
```tsx
// In your test
vi.mocked(useQuery).mockReturnValue(undefined);

// ConvexQueryBoundary should show loading fallback
```

### Test Mutation Errors
```tsx
const mockMutation = vi.fn().mockRejectedValue(
  new ConvexError('Test error')
);
vi.mocked(useMutation).mockReturnValue(mockMutation);

// Component should handle with try/catch
```

## Monitoring

All errors are automatically sent to:
- **Sentry**: Full error tracking with stack traces
- **PostHog**: Session replays for debugging user experience

Check these dashboards when investigating issues.

## Migration Guide

If you have old components not using this pattern:

### Before
```tsx
function OldComponent() {
  const data = useQuery(api.getData);
  
  if (!data) return <div>Loading...</div>;
  
  return <div>{data.name}</div>;
}
```

### After
```tsx
function NewComponent() {
  const data = useQuery(api.getData);
  
  return (
    <ConvexQueryBoundary queries={[{ data }]}>
      <div>{data.name}</div>
    </ConvexQueryBoundary>
  );
}
```

## References

- [Convex Error Handling Docs](https://docs.convex.dev/functions/error-handling/)
- [Convex Application Errors](https://docs.convex.dev/functions/error-handling/application-errors)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

