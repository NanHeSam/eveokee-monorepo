/// <reference types="vite/client" />

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (
      command: 'config' | 'set' | 'event' | 'js',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void
  }
}

export {}
