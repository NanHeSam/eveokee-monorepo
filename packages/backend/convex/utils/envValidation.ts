/**
 * Environment Variable Validation
 * 
 * Validates all required environment variables at startup to fail fast.
 * This prevents runtime errors when missing environment variables are accessed.
 */

/**
 * Environment variable configuration
 * Defines which variables are required vs optional
 */
const ENV_CONFIG = {
  // Clerk Authentication
  CLERK_FRONTEND_API_URL: { required: true, description: "Clerk domain for authentication" },
  CLERK_WEBHOOK_SIGNING_SECRET: { required: true, description: "Clerk webhook signing secret" },

  // OpenAI Integration
  OPENAI_API_KEY: { required: true, description: "OpenAI API key for music prompt generation" },
  OPENAI_TIMEOUT: { required: false, description: "OpenAI API timeout in milliseconds" },

  // Note: CONVEX_SITE_URL is provided automatically by Convex, no need to set it manually

  // Suno Integration
  SUNO_API_KEY: { required: true, description: "Suno API key for music generation" },
  SUNO_TIMEOUT: { required: false, description: "Suno API timeout in milliseconds" },

  // Kie.ai Integration (Video Generation)
  KIE_AI_API_KEY: { required: true, description: "Kie.ai API key for video generation using Sora 2" },
  KIE_AI_TIMEOUT: { required: false, description: "Kie.ai API timeout in milliseconds" },

  // VAPI Integration
  VAPI_API_KEY: { required: true, description: "VAPI API key for voice calls" },
  VAPI_PHONE_NUMBER_ID: { required: true, description: "VAPI phone number identifier" },
  VAPI_WEBHOOK_SECRET: { required: true, description: "VAPI webhook authentication secret" },
  VAPI_TIMEOUT: { required: false, description: "VAPI API timeout in milliseconds" },
  VAPI_CREDENTIAL_ID: { required: false, description: "Credential ID to use for assistant calls" },

  // RevenueCat Integration
  REVENUECAT_API_KEY: { required: true, description: "RevenueCat API key for subscription management" },
  REVENUECAT_PROJECT_ID: { required: true, description: "RevenueCat project ID for API v2" },
  REVENUECAT_WEBHOOK_SECRET: { required: true, description: "RevenueCat webhook authentication secret" },
  REVENUECAT_TIMEOUT: { required: false, description: "RevenueCat API timeout in milliseconds" },

  // Sharing (optional - has fallback)
  SHARE_BASE_URL: { required: false, description: "Base URL for generating shareable music links (has fallback)" },
} as const;

/**
 * Validates all required environment variables
 * @throws {Error} If any required environment variable is missing
 */
export function validateEnvironmentVariables(): void {
  const missing: Array<{ name: string; description: string }> = [];

  // Check each environment variable
  for (const [varName, config] of Object.entries(ENV_CONFIG)) {
    const value = process.env[varName];
    
    if (config.required && !value) {
      missing.push({
        name: varName,
        description: config.description,
      });
    }
  }

  // If any required variables are missing, throw an error with helpful details
  if (missing.length > 0) {
    const missingList = missing
      .map(({ name, description }) => `  - ${name}: ${description}`)
      .join("\n");

    const errorMessage = `Missing required environment variables:\n${missingList}\n\n` +
      `Please set these in your Convex dashboard (Settings → Environment Variables) or `.concat(
        `in your local .env.local file for development.\n\n` +
        `See packages/backend/docs/ENV_VARS.md for detailed setup instructions.`
      );

    throw new Error(errorMessage);
  }
}

/**
 * Get a summary of environment variable status
 * Useful for debugging and logging
 */
export function getEnvironmentVariableStatus(): {
  required: { present: number; missing: number };
  optional: { present: number; total: number };
  missing: Array<{ name: string; description: string }>;
} {
  const missing: Array<{ name: string; description: string }> = [];
  let requiredPresent = 0;
  let optionalPresent = 0;
  let optionalTotal = 0;

  for (const [varName, config] of Object.entries(ENV_CONFIG)) {
    const value = process.env[varName];
    
    if (config.required) {
      if (value) {
        requiredPresent++;
      } else {
        missing.push({
          name: varName,
          description: config.description,
        });
      }
    } else {
      optionalTotal++;
      if (value) {
        optionalPresent++;
      }
    }
  }

  return {
    required: {
      present: requiredPresent,
      missing: missing.length,
    },
    optional: {
      present: optionalPresent,
      total: optionalTotal,
    },
    missing,
  };
}

