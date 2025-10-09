# Deployment Guide - Diary Vibes Landing Page

## 1. Pre-Deployment Checklist

### 1.1 Code Preparation
- [ ] All features tested locally
- [ ] No console errors or warnings
- [ ] TypeScript compilation successful (`npm run check`)
- [ ] ESLint passes without errors (`npm run lint`)
- [ ] Build process completes successfully (`npm run build`)
- [ ] Environment variables properly configured

### 1.2 Clerk Authentication Setup
- [ ] Clerk application configured for production
- [ ] Google OAuth provider enabled and configured
- [ ] Production domain added to Clerk allowed origins
- [ ] Production environment variables ready
- [ ] Test authentication flow in development

### 1.3 Performance Optimization
- [ ] Images optimized and compressed
- [ ] Unused dependencies removed
- [ ] Bundle size analyzed
- [ ] Code splitting implemented where needed
- [ ] Lazy loading for non-critical components

## 2. Environment Configuration

### 2.1 Production Environment Variables

Create these environment variables in your deployment platform:

```bash
# Clerk Configuration (Production)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
CLERK_SECRET_KEY=sk_live_your_production_secret
VITE_CLERK_FRONTEND_API_URL=https://your-domain.clerk.accounts.dev

# Optional: Analytics and Monitoring
VITE_GA_TRACKING_ID=your_google_analytics_id
VITE_SENTRY_DSN=your_sentry_dsn
```

### 2.2 Clerk Production Setup

1. **Upgrade to Production**:
   - Go to Clerk Dashboard → Settings → General
   - Click "Go Live" to upgrade to production
   - Update your environment variables with production keys

2. **Domain Configuration**:
   - Add your production domain to allowed origins
   - Configure redirect URLs for production
   - Set up custom domain if needed

3. **OAuth Configuration**:
   - Update Google OAuth settings with production URLs
   - Verify callback URLs are correct
   - Test OAuth flow in production environment

## 3. Deployment Platforms

### 3.1 Vercel Deployment (Recommended)

**Why Vercel?**
- Optimized for React applications
- Automatic deployments from Git
- Built-in environment variable management
- Excellent performance and CDN

**Step-by-Step Instructions:**

1. **Install Vercel CLI** (optional):
   ```bash
   npm install -g vercel
   ```

2. **Deploy via Web Interface**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure build settings:
     - Framework Preset: `Vite`
     - Build Command: `npm run build`
     - Output Directory: `dist`
     - Install Command: `npm install`

3. **Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add all production environment variables
   - Ensure `VITE_` prefix for client-side variables

4. **Domain Configuration**:
   - Add custom domain in Project Settings → Domains
   - Update Clerk allowed origins with new domain

**Vercel Configuration File** (optional):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 3.2 Netlify Deployment

**Step-by-Step Instructions:**

1. **Deploy via Web Interface**:
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Connect your repository
   - Configure build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`

2. **Environment Variables**:
   - Go to Site Settings → Environment Variables
   - Add all production environment variables

3. **Redirects Configuration**:
   Create `public/_redirects` file:
   ```
   /*    /index.html   200
   ```

**Netlify Configuration File** (`netlify.toml`):
```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 3.3 Railway Deployment

**Step-by-Step Instructions:**

1. **Deploy via Web Interface**:
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Connect your GitHub repository

2. **Configuration**:
   - Railway auto-detects Vite projects
   - Add environment variables in Variables tab
   - Custom start command (if needed): `npm run preview`

3. **Build Configuration**:
   Create `railway.json`:
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "npm run preview",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

### 3.4 GitHub Pages Deployment

**Step-by-Step Instructions:**

1. **Install gh-pages**:
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update package.json**:
   ```json
   {
     "homepage": "https://yourusername.github.io/diary-vibes-landing-page",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

4. **Configure Repository**:
   - Go to repository Settings → Pages
   - Select `gh-pages` branch as source

## 4. Build Optimization

### 4.1 Vite Configuration

Update `vite.config.ts` for production:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          clerk: ['@clerk/clerk-react'],
          router: ['react-router-dom']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
```

### 4.2 Performance Optimizations

1. **Code Splitting**:
   ```typescript
   // Lazy load components
   const Dashboard = lazy(() => import('./pages/Dashboard'))
   const SignIn = lazy(() => import('./pages/SignIn'))
   ```

2. **Image Optimization**:
   - Use WebP format for images
   - Implement lazy loading for images
   - Optimize image sizes for different screen sizes

3. **Bundle Analysis**:
   ```bash
   npm install --save-dev rollup-plugin-visualizer
   npm run build -- --analyze
   ```

## 5. Post-Deployment Testing

### 5.1 Functionality Testing
- [ ] Landing page loads correctly
- [ ] All navigation links work
- [ ] Sign-in/sign-up flow functions
- [ ] Google OAuth authentication works
- [ ] Protected routes redirect properly
- [ ] User dashboard displays correctly
- [ ] Sign-out functionality works

### 5.2 Performance Testing
- [ ] Page load speed (< 3 seconds)
- [ ] Lighthouse score (> 90)
- [ ] Mobile responsiveness
- [ ] Cross-browser compatibility
- [ ] SSL certificate active

### 5.3 SEO and Accessibility
- [ ] Meta tags properly set
- [ ] Open Graph tags configured
- [ ] Accessibility standards met
- [ ] Proper heading structure
- [ ] Alt text for images

## 6. Monitoring and Analytics

### 6.1 Error Monitoring

**Sentry Integration**:
```bash
npm install @sentry/react @sentry/tracing
```

```typescript
// main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});
```

### 6.2 Analytics

**Google Analytics 4**:
```typescript
// Add to index.html
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_TRACKING_ID');
</script>
```

## 7. Troubleshooting Common Issues

### 7.1 Clerk Authentication Issues

**Problem**: Authentication not working in production
**Solutions**:
- Verify production keys are correct
- Check allowed origins in Clerk dashboard
- Ensure HTTPS is enabled
- Verify redirect URLs are correct

**Problem**: Google OAuth fails
**Solutions**:
- Update Google OAuth settings with production URLs
- Check Google Console for authorized domains
- Verify callback URLs match exactly

### 7.2 Build Issues

**Problem**: Build fails with TypeScript errors
**Solutions**:
```bash
# Check TypeScript configuration
npm run check

# Update dependencies
npm update

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Problem**: Environment variables not working
**Solutions**:
- Ensure `VITE_` prefix for client-side variables
- Check deployment platform environment variable settings
- Verify variable names match exactly

### 7.3 Routing Issues

**Problem**: 404 errors on page refresh
**Solutions**:
- Configure proper redirects (see platform-specific sections)
- Ensure SPA routing is properly configured
- Check server configuration for history API fallback

### 7.4 Performance Issues

**Problem**: Slow loading times
**Solutions**:
- Implement code splitting
- Optimize images and assets
- Enable compression (gzip/brotli)
- Use CDN for static assets
- Analyze bundle size and remove unused code

## 8. Security Considerations

### 8.1 Environment Variables
- Never commit `.env.local` to version control
- Use different keys for development and production
- Regularly rotate API keys and secrets
- Use least privilege principle for API permissions

### 8.2 HTTPS and Security Headers
- Always use HTTPS in production
- Configure security headers:
  ```
  Content-Security-Policy
  X-Frame-Options
  X-Content-Type-Options
  Referrer-Policy
  ```

### 8.3 Clerk Security
- Enable MFA for admin accounts
- Configure session timeout appropriately
- Monitor authentication logs
- Set up alerts for suspicious activity

## 9. Maintenance and Updates

### 9.1 Regular Updates
- Keep dependencies updated
- Monitor security advisories
- Update Clerk SDK regularly
- Review and update environment variables

### 9.2 Backup and Recovery
- Regular database backups (if applicable)
- Version control for all configuration
- Document deployment procedures
- Test recovery procedures

### 9.3 Monitoring
- Set up uptime monitoring
- Monitor error rates and performance
- Track user authentication metrics
- Regular security audits

## 10. Quick Deployment Commands

### For Vercel:
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Production deployment
vercel --prod
```

### For Netlify:
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy

# Production deployment
netlify deploy --prod
```

### For Railway:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway link
railway up
```

This comprehensive deployment guide ensures your Diary Vibes landing page with Clerk authentication is properly deployed, secure, and performant across multiple platforms.