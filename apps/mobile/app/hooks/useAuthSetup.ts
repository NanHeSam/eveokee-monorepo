import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@backend/convex';

/**
 * Custom hook for handling authentication setup including Convex user creation
 * with retry logic and user feedback.
 */
export const useAuthSetup = () => {
  const ensureCurrentUserMutation = useMutation(api.users.ensureCurrentUser);

  /**
   * Ensures a Convex user document exists for the authenticated user.
   * Retries up to 3 times with exponential backoff (200ms, 400ms, 800ms).
   * Shows user-facing error if all retries fail.
   *
   * @returns The user document if successful, null if all retries failed
   */
  const ensureConvexUser = useCallback(async () => {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const result = await ensureCurrentUserMutation();
        if (result) {
          return result;
        }
      } catch (err) {
        if (attempt === maxAttempts - 1) {
          console.error('Failed to ensure Convex user document', err);
          Alert.alert(
            'Setup Incomplete',
            'Your account was created but setup is incomplete. Please try signing in again.'
          );
        }
      }

      // Exponential backoff: 200ms, 400ms, 800ms
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, attempt)));
      }
    }

    return null;
  }, [ensureCurrentUserMutation]);

  return { ensureConvexUser };
};
