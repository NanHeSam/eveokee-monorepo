import { createGateway } from "@ai-sdk/gateway";
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

  getModel(modelName: string = DEFAULT_MODEL) {
    return this.gateway(modelName);
  }
}
