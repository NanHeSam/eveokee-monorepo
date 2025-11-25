import { createGateway } from "@ai-sdk/gateway";
// Default model in the format "provider/model-name"
const DEFAULT_MODEL = "openai/gpt-5.1-instant";

type AIClientConfig = {
  apiKey: string;
  baseURL?: string;
};

/**
 * Client wrapper for Vercel AI SDK routed through the AI Gateway.
 * 
 * Uses the Vercel AI Gateway to access multiple model providers through a single endpoint.
 * Models are specified in the format "provider/model-name" (e.g., "openai/gpt-5.1-instant", "zai/glm-4.6").
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
