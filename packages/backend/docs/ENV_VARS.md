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

## Verification

To verify all environment variables are set correctly:

1. **Local:** Check that your `.env.local` contains all required variables
2. **Production:** Review the Environment Variables section in your Convex dashboard
3. **Code:** Check for `process.env.*` usage across the codebase:
   ```bash
   grep -r "process\.env\." packages/backend/convex/
   ```

## Security Notes

- Never commit `.env.local` or any file containing actual secrets to version control
- `.env.local` is gitignored by default
- Rotate API keys regularly, especially if they're exposed
- Use the principle of least privilege when generating API keys
- Monitor your Convex dashboard audit logs for unauthorized access

