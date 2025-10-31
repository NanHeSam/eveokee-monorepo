# Convex Backend Environment Variables

This document lists all environment variables required by the Convex backend.

## Setting Environment Variables

### Local Development
1. Create a `.env.local` file in the repository root
2. Add your environment variables (see examples below)
3. Run `npx convex dev` - the Convex CLI will automatically load `.env.local`

### Production Deployment
Set environment variables in your Convex dashboard:
1. Navigate to https://dashboard.convex.dev
2. Select your project
3. Go to Settings → Environment Variables
4. Add each required variable
5. Deploy your functions with `npx convex deploy`

**Important:** The Convex dashboard is the source of truth for production environment variables. CI/CD workflows and local `.env.local` files are only for development convenience.

## Required Environment Variables

### SHARE_BASE_URL
**Purpose:** Base URL for generating shareable music links

**Used in:** `convex/sharing.ts` (createShareLink, getMySharedMusic)

**Values:**
- **Local Development:** `http://localhost:5173`
- **Production:** Your production domain (e.g., `https://yourdomain.com`)

**Default Fallback:** `https://eveokee.com` (DO NOT rely on this in production)

**Example:**
```bash
# Local development
SHARE_BASE_URL=http://localhost:5173

# Production
SHARE_BASE_URL=https://yourdomain.com
```

**Important:** Always set this in your Convex dashboard for production deployments to ensure share links point to your actual domain, not the hardcoded fallback.

---

### CLERK_WEBHOOK_SIGNING_SECRET
**Purpose:** Validates webhook requests from Clerk authentication service

**Used in:** `convex/http.ts`

**Where to find:** Clerk Dashboard → Webhooks → Signing Secret

**Example:**
```bash
CLERK_WEBHOOK_SIGNING_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

---

### CLERK_FRONTEND_API_URL
**Purpose:** Clerk domain for authentication

**Used in:** `convex/auth.config.ts`

**Format:** `https://<your-clerk-domain>.clerk.accounts.dev`

**Example:**
```bash
CLERK_FRONTEND_API_URL=https://your-app.clerk.accounts.dev
```

---

### OPENAI_API_KEY
**Purpose:** OpenAI API access for music prompt generation

**Used in:** `convex/musicActions.ts`

**Where to find:** https://platform.openai.com/api-keys

**Example:**
```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
```

---

### SUNO_API_KEY
**Purpose:** Suno API access for music generation

**Used in:** `convex/musicActions.ts`

**Example:**
```bash
SUNO_API_KEY=xxxxxxxxxxxxxxxxxxxxx
```

---

### SUNO_CALLBACK_URL
**Purpose:** Webhook endpoint URL for Suno to send music generation status updates

**Used in:** `convex/musicActions.ts`

**Format:** Should point to your Convex HTTP endpoint for Suno webhooks

**Example:**
```bash
# Production
SUNO_CALLBACK_URL=https://your-convex-deployment.convex.cloud/http/suno-webhook

# Local development (using ngrok or similar)
SUNO_CALLBACK_URL=https://your-tunnel.ngrok.io/http/suno-webhook
```

---

### VAPI_API_KEY
**Purpose:** VAPI API key for scheduling and managing voice calls

**Used in:** `convex/integrations/vapi/integration.ts`

**Where to find:** VAPI Dashboard → API Keys

**Example:**
```bash
VAPI_API_KEY=xxxxxxxxxxxxxxxxxxxxx
```

---

### VAPI_WEBHOOK_URL
**Purpose:** Webhook callback URL for VAPI to send call status updates

**Used in:** `convex/integrations/vapi/integration.ts`

**Format:** Should point to your Convex HTTP endpoint for VAPI webhooks

**Example:**
```bash
# Production
VAPI_WEBHOOK_URL=https://your-convex-deployment.convex.cloud/http/vapi-webhook

# Local development (using ngrok or similar)
VAPI_WEBHOOK_URL=https://your-tunnel.ngrok.io/http/vapi-webhook
```

---

### VAPI_PHONE_NUMBER_ID
**Purpose:** VAPI phone number identifier to use for outbound calls

**Used in:** `convex/integrations/vapi/integration.ts`

**Where to find:** VAPI Dashboard → Phone Numbers

**Example:**
```bash
VAPI_PHONE_NUMBER_ID=xxxxxxxxxxxxxxxxxxxxx
```

---

### VAPI_WEBHOOK_SECRET
**Purpose:** Authentication secret for validating VAPI webhook requests

**Used in:** `convex/webhooks/handlers/vapi.ts`

**Where to find:** Configured in VAPI webhook settings

**Example:**
```bash
VAPI_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

---

### REVENUECAT_API_KEY
**Purpose:** RevenueCat API key for subscription management

**Used in:** `convex/revenueCatBilling.ts`

**Where to find:** RevenueCat Dashboard → API Keys

**Example:**
```bash
REVENUECAT_API_KEY=xxxxxxxxxxxxxxxxxxxxx
```

---

### REVENUECAT_WEBHOOK_SECRET
**Purpose:** Authentication secret for validating RevenueCat webhook requests

**Used in:** `convex/webhooks/handlers/revenuecat.ts`

**Where to find:** RevenueCat Dashboard → Webhooks → Secret

**Example:**
```bash
REVENUECAT_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

---

## Optional Environment Variables

These variables have defaults or are only used for fine-tuning:

### OPENAI_TIMEOUT
**Purpose:** Timeout in milliseconds for OpenAI API requests (optional)

**Default:** No timeout

**Example:**
```bash
OPENAI_TIMEOUT=30000
```

---

### SUNO_TIMEOUT
**Purpose:** Timeout in milliseconds for Suno API requests (optional)

**Default:** No timeout

**Example:**
```bash
SUNO_TIMEOUT=60000
```

---

### VAPI_TIMEOUT
**Purpose:** Timeout in milliseconds for VAPI API requests (optional)

**Default:** No timeout

**Example:**
```bash
VAPI_TIMEOUT=30000
```

---

### VAPI_CREDENTIAL_ID
**Purpose:** Credential ID to use for assistant calls (optional)

**Used in:** `convex/integrations/vapi/integration.ts`

**Description:** This is the credential that will be used for the assistant calls. By default, all credentials are available for use in the call, but you can provide a specific credential ID using this variable. The credential ID will be wrapped in an array when passed to the assistant configuration.

**Example:**
```bash
VAPI_CREDENTIAL_ID=your-credential-id-here
```

---

### REVENUECAT_TIMEOUT
**Purpose:** Timeout in milliseconds for RevenueCat API requests (optional)

**Default:** No timeout

**Example:**
```bash
REVENUECAT_TIMEOUT=30000
```

---

## Verification

The Convex backend automatically validates all required environment variables at startup. If any required variables are missing, the service will fail to start with a clear error message listing which variables are missing.

To verify all environment variables are set correctly:

1. **Local:** Check that your `.env.local` contains all required variables
2. **Production:** Review the Environment Variables section in your Convex dashboard
3. **Startup:** The service will automatically fail on startup if required variables are missing
4. **Code:** Check for `process.env.*` usage across the codebase:
   ```bash
   grep -r "process\.env\." packages/backend/convex/
   ```

**Note:** The validation runs automatically when the Convex backend starts, so missing environment variables will be caught immediately rather than at runtime.

## Security Notes

- Never commit `.env.local` or any file containing actual secrets to version control
- `.env.local` is gitignored by default
- Rotate API keys regularly, especially if they're exposed
- Use the principle of least privilege when generating API keys
- Monitor your Convex dashboard audit logs for unauthorized access

