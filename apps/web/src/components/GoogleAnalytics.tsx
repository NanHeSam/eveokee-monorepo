import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'

/**
 * Component to track page views and user identification with Google Analytics
 * Tracks page views on route changes and identifies users when they sign in
 */
export default function GoogleAnalytics() {
  const location = useLocation()
  const { isLoaded, isSignedIn, userId } = useAuth()

  // Track page views on route changes
  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('config', 'G-9YP6TKJ6FB', {
        page_path: location.pathname + location.search,
      })
    }
  }, [location])

  // Identify users when they sign in
  useEffect(() => {
    if (!isLoaded || typeof window.gtag !== 'function') return

    if (isSignedIn && userId) {
      window.gtag('set', { user_id: userId })
    } else {
      // Clear user_id when signed out
      window.gtag('set', { user_id: null })
    }
  }, [isLoaded, isSignedIn, userId])

  return null
}

