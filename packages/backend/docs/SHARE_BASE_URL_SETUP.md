# SHARE_BASE_URL Configuration - Setup Summary

This document summarizes the work done to properly document and configure the `SHARE_BASE_URL` environment variable for the Convex backend's music sharing feature.

## Problem Statement

The `sharing.ts` module was using a hardcoded fallback URL (`https://eveokee.com`) for generating shareable music links. This could lead to production deployments generating incorrect share links if the environment variable wasn't properly set.

## Solution Implemented

### 1. Created Comprehensive Environment Variables Documentation

**File:** `packages/backend/ENV_VARS.md`

A complete reference guide for all Convex backend environment variables, including:
- Purpose and usage of each variable
- Where to find/configure values
- Local development vs. production setup instructions
- Examples and security notes

**Key sections:**
- SHARE_BASE_URL configuration (with emphasis on production requirements)
- Authentication variables (Clerk)
- AI/Music generation variables (OpenAI, Suno)
- Verification steps

### 2. Updated Main Repository README

**File:** `README.md`

Added a dedicated Convex Backend section under Environment Variables with:
- List of all required environment variables
- Instructions for local development (`.env.local`)
- Instructions for production (Convex dashboard)
- Link to detailed `ENV_VARS.md` documentation
- Emphasis on not relying on hardcoded defaults

Also updated the Deployment → Convex Backend section with:
- Explicit checklist of environment variables to set before deploying
- Link to the Convex dashboard environment variables page
- Reference to detailed documentation

### 3. Enhanced Backend Agent Documentation

**File:** `packages/backend/AGENTS.md`

Updated the Environment & Secrets section with:
- Reference to the new `ENV_VARS.md` file
- Critical warning about SHARE_BASE_URL requiring production configuration
- Updated list of required secrets

### 4. Added In-Code Documentation

**File:** `packages/backend/convex/sharing.ts`

Added explanatory comments at all three locations where `SHARE_BASE_URL` is used:
- Lines 73-75 (in `createShareLink` - existing share)
- Lines 96-98 (in `createShareLink` - new share)
- Lines 268-270 (in `getMySharedMusic`)

**Comment content:**
```typescript
// SHARE_BASE_URL should be set in Convex dashboard (Settings → Environment Variables)
// Fallback to eveokee.com is for development only
// See packages/backend/ENV_VARS.md for setup instructions
```

### 5. Created Deployment Checklist

**File:** `packages/backend/DEPLOYMENT.md`

Comprehensive deployment guide including:
- Pre-deployment checklist with all environment variables
- Step-by-step verification procedures
- Post-deployment testing instructions specifically for share links
- Common issues and troubleshooting
- Rollback procedures

**Critical Share Link Testing Section:**
```bash
# Expected: https://yourdomain.com/share/ABC123xyz
# WRONG: https://eveokee.com/share/ABC123xyz
```

## Files Modified

1. ✅ **Created:** `packages/backend/ENV_VARS.md`
2. ✅ **Created:** `packages/backend/DEPLOYMENT.md`
3. ✅ **Created:** `packages/backend/docs/SHARE_BASE_URL_SETUP.md` (this file)
4. ✅ **Modified:** `packages/backend/convex/sharing.ts` (added documentation comments)
5. ✅ **Modified:** `packages/backend/AGENTS.md` (updated Environment & Secrets section)
6. ✅ **Modified:** `README.md` (added Convex Backend environment variables section)

## Testing Results

✅ **All tests pass:** `pnpm test:backend` - 91 tests passed across 6 test files
- No existing functionality was broken
- Comments added to `sharing.ts` are documentation-only

## Deployment Configuration Notes

### Where to Set SHARE_BASE_URL

**Local Development:**
```bash
# Create .env.local in repository root
SHARE_BASE_URL=http://localhost:5173
```

**Production Deployment:**
1. Navigate to https://dashboard.convex.dev
2. Select your project
3. Go to Settings → Environment Variables
4. Click "Add Environment Variable"
5. Name: `SHARE_BASE_URL`
6. Value: `https://yourdomain.com` (your actual production domain)
7. Click Save

### CI/CD Configuration

**No changes required to GitHub Actions workflow** - Convex environment variables are managed through the dashboard, not via GitHub secrets or CI environment variables.

The existing workflow in `.github/workflows/ci.yml` already handles Convex deployments correctly:
```yaml
- name: Deploy to Convex
  run: npx convex deploy
  env:
    CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

### Verification Steps

After setting `SHARE_BASE_URL` in production:

1. **Deploy the backend:**
   ```bash
   pnpm --filter @backend/convex deploy
   ```

2. **Test share link generation:**
   - Create or select a music track in your app
   - Generate a share link using the UI
   - Verify the returned URL contains your domain, not `eveokee.com`

3. **Test the share link:**
   - Open the generated link in an incognito/private window
   - Verify the music plays correctly
   - Check that analytics/view counting works

## Benefits of This Implementation

1. **Comprehensive Documentation:** All environment variables are now documented in one place
2. **Clear Production Requirements:** Developers know exactly what to set before deploying
3. **In-Code Reminders:** Comments in `sharing.ts` prevent future confusion
4. **Deployment Safety:** Checklist ensures critical configuration isn't missed
5. **Troubleshooting Guide:** Common issues are documented with solutions
6. **No Breaking Changes:** Only documentation was added, no code behavior changed

## Next Steps for Deployment Team

1. ✅ Review the documentation in `ENV_VARS.md`
2. ⚠️ **Action Required:** Set `SHARE_BASE_URL` in Convex dashboard to your production domain
3. ⚠️ **Action Required:** Verify all other environment variables are set per `ENV_VARS.md`
4. ✅ Deploy the updated code with `pnpm --filter @backend/convex deploy`
5. ✅ Test share link generation after deployment
6. ✅ Follow the `DEPLOYMENT.md` checklist for future deployments

## References

- Main README: `/README.md` (root)
- Environment Variables Reference: `packages/backend/ENV_VARS.md`
- Deployment Checklist: `packages/backend/DEPLOYMENT.md`
- Backend Developer Guide: `packages/backend/AGENTS.md`
- Sharing Implementation: `packages/backend/convex/sharing.ts`
- Convex Documentation: https://docs.convex.dev/
- Convex Dashboard: https://dashboard.convex.dev/

