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

### CONVEX_SITE_URL (Automatic)
**Purpose:** Site URL of the Convex deployment, used to construct callback URLs for webhooks

**Used in:** `convex/musicActions.ts`, `convex/videoActions.ts`, `convex/integrations/vapi/integration.ts`

**Format:** Automatically provided by Convex (e.g., `https://your-deployment.convex.site`)

**Note:** This variable is **automatically provided by Convex** - you do NOT need to set it manually. It replaces the previous `SUNO_CALLBACK_URL`, `KIE_CALLBACK_URL`, and `VAPI_WEBHOOK_URL` variables. The system automatically constructs the full callback URLs by appending the appropriate paths:
- Suno: `CONVEX_SITE_URL` + `/callback/suno-music-generation`
- Kie.ai: `CONVEX_SITE_URL` + `/callback/kie-video-generation`
- VAPI: `CONVEX_SITE_URL` + `/webhooks/vapi`

---

### KIE_AI_API_KEY
**Purpose:** Kie.ai API access for video generation using Sora 2 model

**Used in:** `convex/videoActions.ts`

**Where to find:** https://kie.ai (API Keys section)

**Example:**
```bash
KIE_AI_API_KEY=xxxxxxxxxxxxxxxxxxxxx
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

### BLOG_WEBHOOK_HMAC_SECRET
**Purpose:** HMAC secret key for authenticating blog API webhook requests

**Used in:** `convex/webhooks/handlers/blogApi.ts`

**Description:** This secret is used to verify HMAC SHA-256 signatures sent in the `X-Signature` header along with the `X-Timestamp` header. The webhook handler validates that requests are authentic and not tampered with.

**Where to find:** Configure this in your external blog automation service (e.g., RankPill) when setting up the webhook integration.

**Example:**
```bash
BLOG_WEBHOOK_HMAC_SECRET=your-hmac-secret-key-here
```

---

### SLACK_WEBHOOK_URL
**Purpose:** Slack webhook URL for sending notifications (optional)

**Used in:** `convex/utils/slack.ts`

**Description:** Used to send Slack notifications when RankPill creates new blog drafts for review. If not set, Slack notifications will be skipped but the draft will still be created.

**Where to find:** 
1. Go to https://api.slack.com/apps
2. Create a new app or select an existing one
3. Go to "Incoming Webhooks" and activate it
4. Click "Add New Webhook to Workspace"
5. Select the channel where you want notifications
6. Copy the webhook URL

**Example:**
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
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

### KIE_AI_TIMEOUT
**Purpose:** Timeout in milliseconds for Kie.ai API requests (optional)

**Default:** 30000 (30 seconds)

**Example:**
```bash
KIE_AI_TIMEOUT=60000
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

