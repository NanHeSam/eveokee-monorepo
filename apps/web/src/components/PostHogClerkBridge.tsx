import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { usePostHog } from 'posthog-js/react'

export default function PostHogClerkBridge() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const posthog = usePostHog()

  useEffect(() => {
    if (!isLoaded || !posthog) return

    if (isSignedIn && userId) {
      posthog.identify(userId)
    } else {
      // Reset anonymous user when signed out
      posthog.reset()
    }
  }, [isLoaded, isSignedIn, userId, posthog])

  return null
}