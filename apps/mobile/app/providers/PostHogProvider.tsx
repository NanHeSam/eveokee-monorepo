import React, { useEffect } from 'react';
import PostHog from 'posthog-react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const environment = process.env.EXPO_PUBLIC_ENVIRONMENT || 'development';

export const posthogClient = posthogApiKey
  ? new PostHog(posthogApiKey, {
      host: posthogHost,
      enableSessionReplay: true,
      sessionReplayConfig: {
        maskAllTextInputs: true,
        maskAllImages: false,
        captureNetworkTelemetry: true,
      },
    })
  : null;

// Register super properties that will be sent with every event
if (posthogClient) {
  posthogClient.register({
    environment,
    platform: Platform.OS,
    app_version: Constants.expoConfig?.version || '1.0.0',
    app_build: Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode,
  });

  if (environment === 'development') {
    console.log('[PostHog] Initialized with environment:', environment);
    console.log('[PostHog] Super properties registered:', {
      environment,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version,
    });
  }
}

interface PostHogProviderProps {
  children: React.ReactNode;
}

export const PostHogProvider: React.FC<PostHogProviderProps> = ({ children }) => {
  const { userId, isSignedIn } = useAuth();

  useEffect(() => {
    if (posthogClient && isSignedIn && userId) {
      // Identify the user when they sign in
      posthogClient.identify(userId);
    }
  }, [isSignedIn, userId]);

  useEffect(() => {
    if (posthogClient && !isSignedIn) {
      // Reset on sign out
      posthogClient.reset();
    }
  }, [isSignedIn]);

  return <>{children}</>;
};
