import { createGateway } from "@ai-sdk/gateway";
import { AI_GATEWAY_DEFAULT_MODEL } from "../../utils/constants/ai";

type AIClientConfig = {
  apiKey: string;
  baseURL?: string;
};

/**
 * Client wrapper for Vercel AI SDK routed through the AI Gateway.
 * 
 * Uses the Vercel AI Gateway to access multiple model providers through a single endpoint.
 * Models are specified in the format "provider/model-name" (e.g., "anthropic/claude-haiku-5.5").
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
      // Let the installed provider select its matching wire-protocol endpoint.
      // Gateway v4 sends tagged file data that the legacy /v1/ai route rejects.
      baseURL,
    });
  }

  getModel(modelName: string = AI_GATEWAY_DEFAULT_MODEL) {
    return this.gateway(modelName);
  }
}
