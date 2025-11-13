import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'
import { PostHogProvider } from 'posthog-js/react'
import PostHogClerkBridge from '@/components/PostHogClerkBridge'
import ErrorFallback from './components/ErrorFallback'
import App from './App'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

if (!CONVEX_URL) {
  throw new Error("Missing Convex URL")
}

const convex = new ConvexReactClient(CONVEX_URL)

// Initialize Sentry as early as possible
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.consoleLoggingIntegration({ levels: ['error', 'warn'] }),
      Sentry.replayIntegration(),
    ],
    // Adjust sample rates as needed
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    enableLogs: true,
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        defaults: '2025-05-24',
        capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
        debug: import.meta.env.MODE === 'development',
      }}
    >
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <Sentry.ErrorBoundary fallback={ErrorFallback} showDialog>
            <PostHogClerkBridge />
            <App />
          </Sentry.ErrorBoundary>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </PostHogProvider>
  </StrictMode>,
)
