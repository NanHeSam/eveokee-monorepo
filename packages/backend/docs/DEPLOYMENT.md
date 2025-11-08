# Convex Backend Deployment Checklist

This checklist ensures all required environment variables and configurations are properly set before deploying the Convex backend to production.

## Pre-Deployment Checklist

### 1. Environment Variables Configuration

Before deploying, verify all environment variables are set in your [Convex dashboard](https://dashboard.convex.dev):

- [ ] **SHARE_BASE_URL** ✅ **CRITICAL**
  - Navigate to: Convex Dashboard → Your Project → Settings → Environment Variables
  - Set to your production domain (e.g., `https://yourdomain.com`)
  - **Never rely on the fallback value** - share links will be broken if this isn't set
  - Test after deployment by creating a share link and verifying it uses your domain

- [ ] **CLERK_WEBHOOK_SIGNING_SECRET**
  - Source: Clerk Dashboard → Webhooks → Signing Secret
  - Required for webhook authentication

- [ ] **CLERK_FRONTEND_API_URL**
  - Format: `https://<your-clerk-domain>.clerk.accounts.dev`
  - Required for Clerk authentication integration

- [ ] **OPENAI_API_KEY**
  - Source: https://platform.openai.com/api-keys
  - Required for music prompt generation

- [ ] **CONVEX_SITE_URL** ✅ **AUTOMATIC**
  - **Note:** This is automatically provided by Convex - you do NOT need to set it manually
  - Used for constructing webhook callback URLs
  - Used by Suno, Kie.ai, and VAPI integrations

- [ ] **SUNO_API_KEY**
  - Source: Your Suno API provider
  - Required for music generation

### 2. GitHub Secrets

Ensure these secrets are set in your GitHub repository:

- [ ] **CONVEX_DEPLOY_KEY**
  - Navigate to: GitHub → Repository → Settings → Secrets and variables → Actions
  - Source: Convex Dashboard → Settings → Deploy Key
  - Required for CI/CD automated deployments

### 3. Deployment Verification

After running `npx convex deploy`:

- [ ] Visit your Convex dashboard and verify the deployment succeeded
- [ ] Check the Functions tab to ensure all functions are listed
- [ ] Monitor the Logs tab for any startup errors
- [ ] Test critical endpoints:
  - [ ] Authentication (sign in/sign up)
  - [ ] Music generation
  - [ ] Share link creation (verify URL uses your domain, not `eveokee.com`)
  - [ ] Webhook endpoints (if applicable)

### 4. Integration Tests

- [ ] Test share link creation from your web or mobile app
- [ ] Copy a generated share link and verify it contains your domain
- [ ] Open the share link in an incognito window to verify it works for unauthenticated users
- [ ] Verify analytics/view counting works for shared music

## Deployment Commands

### Manual Deployment
```bash
# From repository root
pnpm --filter @backend/convex deploy

# Or directly with Convex CLI
cd packages/backend
npx convex deploy
```

### Automated Deployment (CI/CD)

Deployments are automatically triggered by GitHub Actions when:
- Changes are pushed to the `main` branch
- Changes are detected in `packages/backend/convex/**`

See `.github/workflows/ci.yml` for the full workflow.

## Post-Deployment

### Monitoring

1. **Convex Dashboard Logs**
   - Monitor for errors or warnings
   - Check function execution times
   - Review failed function calls

2. **Share Link Testing**
   ```bash
   # Example: Test share link generation
   # 1. Create a music track in your app
   # 2. Generate a share link
   # 3. Verify the link URL:
   # Expected: https://yourdomain.com/share/ABC123xyz
   # WRONG: https://eveokee.com/share/ABC123xyz
   ```

3. **Environment Variable Verification**
   ```bash
   # Check which env vars are set in production
   # Navigate to: Convex Dashboard → Settings → Environment Variables
   # Verify all required variables are present and non-empty
   ```

### Rollback Procedure

If deployment issues occur:

1. **Quick Rollback via Dashboard**
   - Convex Dashboard → Deployments → Select previous version → Rollback

2. **Fix and Redeploy**
   - Fix the issue in your code
   - Run tests: `pnpm test:backend`
   - Redeploy: `pnpm --filter @backend/convex deploy`

3. **Emergency Hotfix**
   - Create a hotfix branch
   - Make minimal changes
   - Test locally
   - Deploy directly or merge to main for CI/CD deployment

## Common Issues

### Issue: Share links use `eveokee.com` instead of my domain
**Cause:** `SHARE_BASE_URL` not set in Convex dashboard  
**Fix:** Set `SHARE_BASE_URL` in Convex Dashboard → Settings → Environment Variables

### Issue: Authentication webhooks failing
**Cause:** Missing or incorrect `CLERK_WEBHOOK_SIGNING_SECRET`  
**Fix:** Verify the signing secret in Clerk Dashboard → Webhooks matches your Convex environment variable

### Issue: Music generation not working
**Cause:** Missing API keys for OpenAI or Suno  
**Fix:** Set `OPENAI_API_KEY` and `SUNO_API_KEY` in Convex dashboard

### Issue: Deployment key invalid
**Cause:** Expired or incorrect `CONVEX_DEPLOY_KEY`  
**Fix:** Generate a new deploy key from Convex Dashboard → Settings and update GitHub secret

## Support & Resources

- **Convex Documentation:** https://docs.convex.dev
- **Environment Variables Guide:** `packages/backend/ENV_VARS.md`
- **Testing Guide:** `packages/backend/__tests__/README.md`
- **Main README:** Repository root `README.md`

