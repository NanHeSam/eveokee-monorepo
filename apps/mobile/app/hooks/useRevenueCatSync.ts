import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { identifyUser, logoutUser } from '../utils/revenueCat';

/**
 * Hook to sync RevenueCat user identity with Convex authentication
 *
 * This ensures that:
 * 1. When a user signs in, RevenueCat is linked to the Convex user ID via Purchases.logIn()
 * 2. When a user signs out, RevenueCat user is cleared via Purchases.logOut()
 * 3. RevenueCat's app_user_id becomes the Convex user._id, enabling webhooks to work
 */
export function useRevenueCatSync() {
  const { isSignedIn, isLoaded } = useAuth();
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const previousSignInState = useRef<boolean | null>(null);

  useEffect(() => {
    // Only run when auth is loaded
    if (!isLoaded) {
      return;
    }

    // Handle sign in
    if (isSignedIn && previousSignInState.current !== true) {
      console.log('[RevenueCat] User signed in, linking RevenueCat identity...');

      const linkUser = async () => {
        try {
          // Get the Convex user ID
          const { userId: convexUserId } = await ensureCurrentUser({});

          // Identify the user in RevenueCat SDK with Convex user ID
          // This calls Purchases.logIn(convexUserId) which sets app_user_id = convexUserId
          // Webhooks will then receive this ID and can look up the user directly
          await identifyUser(convexUserId);

          console.log('[RevenueCat] Successfully linked user:', convexUserId);
        } catch (error) {
          console.error('[RevenueCat] Failed to link user:', error);
        }
      };

      linkUser();
      previousSignInState.current = true;
    }

    // Handle sign out
    if (!isSignedIn && previousSignInState.current === true) {
      console.log('[RevenueCat] User signed out, clearing RevenueCat identity...');

      const unlinkUser = async () => {
        try {
          await logoutUser();
          console.log('[RevenueCat] Successfully cleared user identity');
        } catch (error) {
          console.error('[RevenueCat] Failed to clear user identity:', error);
        }
      };

      unlinkUser();
      previousSignInState.current = false;
    }

    // Update the ref if this is the first check
    if (previousSignInState.current === null) {
      previousSignInState.current = isSignedIn;
    }
  }, [isSignedIn, isLoaded, ensureCurrentUser]);
}
