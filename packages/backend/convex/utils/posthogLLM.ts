"use node";

import { getPostHogClient } from "./posthog";

type LLMEventOptions = {
  operation: string;
  model: string;
  provider?: string;
  userId?: string;
  traceId?: string;
  latencySeconds?: number;
  input?: string;
  output?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  properties?: Record<string, any>;
};

const PREVIEW_LIMIT = 400;

function preview(text?: string): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (trimmed.length <= PREVIEW_LIMIT) return trimmed;
  return `${trimmed.slice(0, PREVIEW_LIMIT)}…`;
}

export async function captureLLMGeneration(options: LLMEventOptions): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  try {
    await client.capture({
      distinctId: options.userId ?? options.traceId ?? "anonymous",
      event: "$ai_generation",
      properties: {
        $ai_model: options.model,
        $ai_provider: options.provider ?? "openai",
        $ai_latency: options.latencySeconds,
        $ai_input_tokens: options.inputTokens,
        $ai_output_tokens: options.outputTokens,
        $ai_total_tokens: options.totalTokens,
        $ai_trace_id: options.traceId,
        operation: options.operation,
        input_preview: preview(options.input),
        output_preview: preview(options.output),
        ...options.properties,
      },
    });

    const flushAsync = (client as unknown as { flushAsync?: () => Promise<void> }).flushAsync;
    if (flushAsync) {
      await flushAsync();
    }
  } catch (error) {
    console.warn("[PostHog] Failed to capture LLM event", error);
  }
}


