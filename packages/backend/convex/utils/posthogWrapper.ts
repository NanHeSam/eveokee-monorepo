"use node";

import { withTracing } from "@posthog/ai";
import { getPostHogClient } from "./posthog";

/**
 * Wrap an AI model with PostHog tracing if PostHog is configured
 * This function must be called from a "use node" action
 * 
 * @param model - The AI model to wrap (from AIClient.getModel())
 * @param options - PostHog tracing options
 * @returns A tuple [model, wasWrapped] where:
 *   - model: The wrapped model with PostHog tracing, or the original model if PostHog is not configured
 *   - wasWrapped: true if PostHog wrapping actually occurred, false otherwise
 */
export function wrapModelWithPostHog(
  model: Parameters<typeof withTracing>[0],
  options: {
    userId?: string;
    traceId?: string;
    operation: string;
    modelName: string;
    additionalProperties?: Record<string, any>;
  }
): [ReturnType<typeof withTracing>, boolean] {
  const posthogClient = getPostHogClient();
  if (!posthogClient) {
    console.warn(
      "[PostHog] Client unavailable; returning original model without tracing",
      {
        operation: options.operation,
        model: options.modelName,
      }
    );
    return [model as ReturnType<typeof withTracing>, false];
  }

  console.log("[PostHog] Wrapping model with tracing", {
    operation: options.operation,
    model: options.modelName,
    userId: options.userId,
    traceId: options.traceId,
    ...(options.additionalProperties ?? {}),
  });

  return [
    withTracing(model, posthogClient, {
      posthogDistinctId: options.userId,
      posthogTraceId: options.traceId,
      posthogProperties: {
        operation: options.operation,
        model: options.modelName,
        ...options.additionalProperties,
      },
    }),
    true,
  ];
}

