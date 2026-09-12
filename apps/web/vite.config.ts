import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
    tailwindcss(),
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
