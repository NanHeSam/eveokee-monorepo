/// <reference types="vite/client" />

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: {
      (
        command: 'config' | 'event',
        targetId: string,
        config?: Record<string, unknown>
      ): void
      (command: 'set', config: Record<string, unknown>): void
      (command: 'js', date: Date): void
    }
  }
}

export {}
