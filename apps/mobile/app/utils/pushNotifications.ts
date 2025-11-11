/**
 * Push Notifications Utility
 * Handles notification permissions, token registration, and notification event handling
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android notification channel configuration
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#A8E6CF',
  });
}

export interface NotificationData {
  type: 'music_ready' | 'video_ready';
  musicId?: string;
  videoId?: string;
  diaryId?: string;
}

/**
 * Request notification permissions and register push token with backend
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return null;
    }

    // Get push token - use projectId from app.json via Constants
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? 
                      Constants?.easConfig?.projectId;
    
    if (!projectId) {
      throw new Error('Project ID not found. Make sure EAS project ID is configured in app.json');
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return tokenData.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Hook to initialize push notifications and register token
 * Should be called once when app starts and user is authenticated
 * Must be called within a ConvexProvider context
 */
export function usePushNotifications() {
  const { isSignedIn, isLoaded } = useAuth();
  const registerPushToken = useMutation(api.pushNotifications.registerPushToken);
  const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | undefined>(undefined);

  useEffect(() => {
    // Only register token if user is signed in
    if (!isLoaded || !isSignedIn) {
      return;
    }

    // Register token when component mounts and user is authenticated
    const registerToken = async () => {
      const token = await registerForPushNotifications();
      if (token) {
        try {
          const platform = Platform.OS === 'ios' ? 'ios' : 'android';
          await registerPushToken({ token, platform });
          console.log('Push token registered successfully');
        } catch (error) {
          console.error('Failed to register push token:', error);
        }
      } else {
        console.warn('No push token received - permissions may not be granted');
      }
    };

    registerToken();

    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      // Notification will be shown automatically based on handler configuration
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
    };
  }, [registerPushToken, isSignedIn, isLoaded]);
}

/**
 * Get the last notification response (for handling notifications when app is opened from quit state)
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

