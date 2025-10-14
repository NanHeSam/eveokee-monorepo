import { useEffect, useRef } from 'react';
import { NavigationContainerRef } from '@react-navigation/native';
import { posthogClient } from '../providers/PostHogProvider';

/**
 * Hook to track screen views and navigation time with PostHog
 * Automatically captures:
 * - Screen views
 * - Time spent on each screen
 * - Navigation patterns
 */
export const usePostHogNavigation = (
  navigationRef: React.RefObject<NavigationContainerRef<any>>
) => {
  const routeNameRef = useRef<string | null>(null);
  const screenStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!posthogClient) {
      return;
    }

    let navigation: NavigationContainerRef<any> | null = null;
    let unsubscribe: (() => void) | undefined;
    let pollTimeout: ReturnType<typeof setTimeout> | undefined;

    const trackScreenTransition = () => {
      if (!navigation) {
        return;
      }

      const previousRouteName = routeNameRef.current;
      const currentRoute = navigation.getCurrentRoute();
      const currentRouteName = currentRoute?.name ?? null;

      if (previousRouteName !== currentRouteName && currentRouteName) {
        if (previousRouteName && screenStartTimeRef.current) {
          const timeSpent = Date.now() - screenStartTimeRef.current;
          posthogClient.capture('screen_time', {
            screen_name: previousRouteName,
            time_spent_ms: timeSpent,
            time_spent_seconds: Math.round(timeSpent / 1000),
          });
        }

        posthogClient.screen(currentRouteName);

        routeNameRef.current = currentRouteName;
        screenStartTimeRef.current = Date.now();
      }
    };

    const attachListeners = (nav: NavigationContainerRef<any>) => {
      navigation = nav;

      const initialRoute = navigation.getCurrentRoute();
      if (initialRoute?.name) {
        routeNameRef.current = initialRoute.name;
        screenStartTimeRef.current = Date.now();
        posthogClient.screen(initialRoute.name);
      }

      unsubscribe = navigation.addListener('state', trackScreenTransition);
    };

    const tryAttach = () => {
      if (navigationRef.current) {
        attachListeners(navigationRef.current);
        return;
      }

      pollTimeout = setTimeout(tryAttach, 100);
    };

    tryAttach();

    return () => {
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }

      if (routeNameRef.current && screenStartTimeRef.current) {
        const timeSpent = Date.now() - screenStartTimeRef.current;
        posthogClient.capture('screen_time', {
          screen_name: routeNameRef.current,
          time_spent_ms: timeSpent,
          time_spent_seconds: Math.round(timeSpent / 1000),
        });
      }

      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [navigationRef]);
};
