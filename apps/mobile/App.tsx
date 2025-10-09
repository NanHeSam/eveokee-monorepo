import './global.css';

import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';
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

export default function App() {
  const colors = useThemeColors();
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          <SafeAreaProvider>
            <TrackPlayerProvider>
              <View style={{ flex: 1 }}>
                <NavigationContainer theme={theme}>
                  <RootNavigator />
                </NavigationContainer>
                <MiniPlayer />
                <FullPlayer />
              </View>
            </TrackPlayerProvider>
          </SafeAreaProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
