// Validate environment variables at startup to fail fast
import { validateEnvironmentVariables } from "./utils/envValidation";

// This will throw an error if any required environment variables are missing
// This ensures we fail early rather than at runtime when the variable is first accessed
try {
  validateEnvironmentVariables();
} catch (error) {
  // Re-throw to ensure the module fails to load, preventing the service from starting
  throw error;
}

export { api, internal } from "./_generated/api";
export type { Doc, Id } from "./_generated/dataModel";
