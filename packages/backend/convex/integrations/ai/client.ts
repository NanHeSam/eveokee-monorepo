import { createGateway } from "@ai-sdk/gateway";
import { generateObject } from "ai";
import { z } from "zod";

// Default model in the format "provider/model-name"
const DEFAULT_MODEL = "google/gemini-2.0-flash-exp";

type AIClientConfig = {
  apiKey: string;
  baseURL?: string;
};

/**
 * Client wrapper for Vercel AI SDK routed through the AI Gateway.
 * 
 * Uses the Vercel AI Gateway to access multiple model providers through a single endpoint.
 * Models are specified in the format "provider/model-name" (e.g., "google/gemini-2.0-flash-exp", "openai/gpt-4o").
 * 
 * @see https://vercel.com/docs/ai-gateway/models-and-providers
 */
export class AIClient {
  private gateway: ReturnType<typeof createGateway>;

  constructor({ apiKey, baseURL }: AIClientConfig) {
    if (!apiKey) {
      throw new Error("Missing AI Gateway API Key");
    }

    this.gateway = createGateway({
      apiKey,
      baseURL: baseURL ?? "https://ai-gateway.vercel.sh/v1/ai",
    });
  }

  /**
   * Generate structured output using a specified model and Zod schema.
   * 
   * @param prompt - The user prompt
   * @param schema - Zod schema defining the expected output structure
   * @param modelName - Model in format "provider/model-name" (e.g., "google/gemini-2.0-flash-exp")
   * @param systemPrompt - Optional system prompt
   * @returns Parsed object matching the schema
   */
  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    modelName: string = DEFAULT_MODEL,
    systemPrompt?: string
  ): Promise<T> {
    const model = this.gateway(modelName);

    const { object } = await generateObject({
      model,
      schema: schema as any,
      prompt,
      system: systemPrompt,
    });

    return object as T;
  }
}
