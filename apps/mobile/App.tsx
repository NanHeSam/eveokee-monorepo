import './global.css';

import { useRef, useEffect, useCallback } from 'react';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, NavigationContainerRef, DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Platform } from 'react-native';

import { DiaryScreen } from './app/screens/DiaryScreen';
import { DiaryEditScreen } from './app/screens/DiaryEditScreen';
import { DiaryViewScreen } from './app/screens/DiaryViewScreen';
import { EventDetailsScreen } from './app/screens/EventDetailsScreen';
import { PersonDetailScreen } from './app/screens/PersonDetailScreen';
import { PersonEditScreen } from './app/screens/PersonEditScreen';
import { PlaylistScreen } from './app/screens/PlaylistScreen';
import { SettingsScreen } from './app/screens/SettingsScreen';
import { AccountScreen } from './app/screens/AccountScreen';
import { PeopleScreen } from './app/screens/PeopleScreen';
import { SignInScreen } from './app/screens/SignInScreen';
import { SignUpScreen } from './app/screens/SignUpScreen';
import { tokenCache } from './app/utils/tokenCache';
import { useThemeColors } from './app/theme/useThemeColors';
import { DiaryStackParamList, SettingsStackParamList } from './app/navigation/types';
import { MiniPlayer } from './app/components/player/MiniPlayer';
import { FullPlayer } from './app/components/player/FullPlayer';
import { TrackPlayerProvider } from './app/providers/TrackPlayerProvider';
import { PostHogProvider } from './app/providers/PostHogProvider';
import { usePostHogNavigation } from './app/hooks/usePostHogNavigation';
import { useRevenueCatSync } from './app/hooks/useRevenueCatSync';
import * as Sentry from '@sentry/react-native';
import { configureRevenueCat } from './app/utils/revenueCat';
import { usePushNotifications, getLastNotificationResponse, type NotificationData } from './app/utils/pushNotifications';
import * as Notifications from 'expo-notifications';

// Only initialize Sentry in production/preview builds (not local development)
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,

    // Adds more context data to events (IP address, cookies, user, etc.)
    // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
    sendDefaultPii: true,

    // Enable Logs
    enableLogs: true,

    // Configure Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

    // uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: __DEV__,
  });
  console.log('Sentry initialized for production/preview build');
} else {
  console.log('Sentry disabled (no DSN provided - local development)');
}

type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  MainTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const DiaryStack = createNativeStackNavigator<DiaryStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const Tab = createBottomTabNavigator();

const DiaryStackNavigator = () => (
  <DiaryStack.Navigator screenOptions={{ headerShown: false }}>
    <DiaryStack.Screen name="DiaryHome" component={DiaryScreen} />
    <DiaryStack.Screen name="DiaryView" component={DiaryViewScreen} />
    <DiaryStack.Screen name="DiaryEdit" component={DiaryEditScreen} />
    <DiaryStack.Screen name="EventDetails" component={EventDetailsScreen} />
    <DiaryStack.Screen name="PersonDetail" component={PersonDetailScreen} />
    <DiaryStack.Screen name="PersonEdit" component={PersonEditScreen} />
  </DiaryStack.Navigator>
);

const SettingsStackNavigator = () => (
  <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
    <SettingsStack.Screen name="SettingsHome" component={SettingsScreen} />
    <SettingsStack.Screen name="Account" component={AccountScreen} />
    <SettingsStack.Screen name="People" component={PeopleScreen} />
    <SettingsStack.Screen name="PersonDetail" component={PersonDetailScreen} />
    <SettingsStack.Screen name="PersonEdit" component={PersonEditScreen} />
    <SettingsStack.Screen name="EventDetails" component={EventDetailsScreen} />
  </SettingsStack.Navigator>
);

const MainTabs = () => {
  const colors = useThemeColors();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: undefined,
        tabBarActiveTintColor: colors.accentMint,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: undefined,
        tabBarIcon: ({ color, focused, size }) => {
          const iconSize = size + (focused ? 2 : 0);
          switch (route.name) {
            case 'Diary':
              return <Ionicons name={focused ? 'book' : 'book-outline'} size={iconSize} color={color} />;
            case 'Playlist':
              return <Ionicons name={focused ? 'musical-notes' : 'musical-notes-outline'} size={iconSize} color={color} />;
            case 'Settings':
              return <Ionicons name={focused ? 'settings' : 'settings-outline'} size={iconSize} color={color} />;
            default:
              return null;
          }
        }
      })}
    >
      <Tab.Screen name="Diary" component={DiaryStackNavigator} />
      <Tab.Screen name="Playlist" component={PlaylistScreen} />
      <Tab.Screen name="Settings" component={SettingsStackNavigator} />
    </Tab.Navigator>
  );
};

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error('Missing EXPO_PUBLIC_CONVEX_URL environment variable.');
}

const convexClient = new ConvexReactClient(convexUrl);

const RootNavigator = ({ navigationRef, onNotificationNavigation }: {
  navigationRef: React.RefObject<NavigationContainerRef<any>>;
  onNotificationNavigation: (data: NotificationData) => void;
}) => {
  const { isLoaded, isSignedIn } = useAuth();

  // Handle notification taps and app opened from notification
  useEffect(() => {
    if (!isSignedIn || !isLoaded) {
      return;
    }

    // Handle notification when app is opened from quit state
    getLastNotificationResponse().then((response) => {
      if (response) {
        const data = response.notification.request.content.data as unknown;
        if (data && typeof data === 'object' && 'type' in data) {
          onNotificationNavigation(data as NotificationData);
        }
      }
    });

    // Listen for notification taps
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as unknown;
      if (data && typeof data === 'object' && 'type' in data) {
        onNotificationNavigation(data as NotificationData);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isSignedIn, isLoaded, onNotificationNavigation]);

  if (!isLoaded) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isSignedIn ? (
        <Stack.Screen name="MainTabs" component={MainTabs} />
      ) : (
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable.');
}

function AppContent() {
  const colors = useThemeColors();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Track navigation and screen time
  usePostHogNavigation(navigationRef);

  // Sync RevenueCat user identity with Convex auth
  useRevenueCatSync();

  // Initialize push notifications (only when signed in)
  usePushNotifications();

  // Handle navigation based on notification data
  const handleNotificationNavigation = useCallback((data: NotificationData) => {
    if (!navigationRef.current) {
      return;
    }

    if (data.type === 'music_ready' && data.musicId) {
      // Navigate to Playlist tab
      navigationRef.current.navigate('MainTabs', {
        screen: 'Playlist',
      });
    } else if (data.type === 'video_ready' && data.musicId) {
      // Navigate to Playlist tab (videos are shown in the music detail view)
      navigationRef.current.navigate('MainTabs', {
        screen: 'Playlist',
      });
    }
  }, []);

  const theme: Theme = colors.scheme === 'dark'
    ? {
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        primary: colors.accentMint
      }
    }
    : {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        primary: colors.accentMint
      }
    };

  return (
    <SafeAreaProvider>
      <TrackPlayerProvider>
        <View style={{ flex: 1 }}>
          <NavigationContainer ref={navigationRef} theme={theme}>
            <RootNavigator navigationRef={navigationRef} onNotificationNavigation={handleNotificationNavigation} />
          </NavigationContainer>
          <MiniPlayer />
          <FullPlayer />
        </View>
      </TrackPlayerProvider>
    </SafeAreaProvider>
  );
}

function App() {
  useEffect(() => {
    const initializeRevenueCat = async () => {
      // Delay RevenueCat initialization to allow other native modules to register first
      await new Promise(resolve => setTimeout(resolve, 100));

      const apiKey = Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
        : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

      if (!apiKey) {
        console.warn(`RevenueCat API key not found for ${Platform.OS}. In-app purchases will not be available.`);
        return;
      }

      try {
        await configureRevenueCat(apiKey);
      } catch (error) {
        console.error('Failed to initialize RevenueCat:', error);
      }
    };

    initializeRevenueCat();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          <PostHogProvider>
            <AppContent />
          </PostHogProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}

// Only wrap with Sentry if it was initialized
export default sentryDsn ? Sentry.wrap(App) : App;
