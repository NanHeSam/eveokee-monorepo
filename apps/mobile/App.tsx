import './global.css';

import { useRef } from 'react';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, NavigationContainerRef, DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View } from 'react-native';

import { DiaryScreen } from './app/screens/DiaryScreen';
import { DiaryEditScreen } from './app/screens/DiaryEditScreen';
import { PlaylistScreen } from './app/screens/PlaylistScreen';
import { SettingsScreen } from './app/screens/SettingsScreen';
import { SignInScreen } from './app/screens/SignInScreen';
import { SignUpScreen } from './app/screens/SignUpScreen';
import { tokenCache } from './app/utils/tokenCache';
import { useThemeColors } from './app/theme/useThemeColors';
import { DiaryStackParamList } from './app/navigation/types';
import { MiniPlayer } from './app/components/player/MiniPlayer';
import { FullPlayer } from './app/components/player/FullPlayer';
import { TrackPlayerProvider } from './app/providers/TrackPlayerProvider';
import { PostHogProvider } from './app/providers/PostHogProvider';
import { usePostHogNavigation } from './app/hooks/usePostHogNavigation';
import * as Sentry from '@sentry/react-native';

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
const Tab = createBottomTabNavigator();

const DiaryStackNavigator = () => (
  <DiaryStack.Navigator screenOptions={{ headerShown: false }}>
    <DiaryStack.Screen name="DiaryHome" component={DiaryScreen} />
    <DiaryStack.Screen name="DiaryEdit" component={DiaryEditScreen} />
  </DiaryStack.Navigator>
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
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error('Missing EXPO_PUBLIC_CONVEX_URL environment variable.');
}

const convexClient = new ConvexReactClient(convexUrl);

const RootNavigator = () => {
  const { isLoaded, isSignedIn } = useAuth();

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
            <RootNavigator />
          </NavigationContainer>
          <MiniPlayer />
          <FullPlayer />
        </View>
      </TrackPlayerProvider>
    </SafeAreaProvider>
  );
}

function App() {
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