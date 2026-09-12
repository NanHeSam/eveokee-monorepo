import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    sourcemap: 'hidden',
  },
  ssr: {
    // React Router v7 + PostHog recommended externals to avoid SSR bundling issues
    external: ['posthog-js', 'posthog-js/react'],
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
  ],
  assetsInclude: ['**/*.md']
})
