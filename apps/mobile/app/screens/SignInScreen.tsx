import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSSO, useClerk } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useMutation } from 'convex/react';
import { api } from 'convex-backend';

import { palette } from '../theme/colors';

WebBrowser.maybeCompleteAuthSession();

const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'musicdiary' });

type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  Home: undefined;
};

export const SignInScreen = () => {
  const { setActive } = useClerk();
  const { startSSOFlow } = useSSO();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const ensureCurrentUserMutation = useMutation(api.users.ensureCurrentUser);

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
        }
      }

      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
      }
    }

    return null;
  }, [ensureCurrentUserMutation]);

  const finalizeSession = useCallback(
    async (
      applySession: ReturnType<typeof useClerk>['setActive'] | null,
      sessionId: string | null | undefined,
    ) => {
      if (!sessionId) {
        return false;
      }

      await applySession?.({ session: sessionId });

      await ensureConvexUser();

      return true;
    },
    [ensureConvexUser],
  );

  const handleGoogleSignIn = useCallback(async () => {
    try {
      setIsGoogleLoading(true);
      const { createdSessionId, setActive: setActiveFromSSO, signIn, signUp } = await startSSOFlow({ strategy: 'oauth_google', redirectUrl });

      const applySession = setActiveFromSSO ?? setActive;

      if (createdSessionId) {
        await finalizeSession(applySession, createdSessionId);
        return;
      }

      if (signIn?.status === 'complete') {
        await finalizeSession(applySession, signIn.createdSessionId);
        return;
      }

      if (signUp?.status === 'complete') {
        await finalizeSession(applySession, signUp.createdSessionId);
        return;
      }
    } catch (err) {
      console.error('Google sign in failed', err);
      if (`${err}`.includes("already signed in")) {
        Alert.alert('Already signed in', 'You are already authenticated.');
      } else {
        Alert.alert('Sign in failed', 'Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }, [finalizeSession, redirectUrl, setActive, startSSOFlow]);

  const handleSignUp = useCallback(() => {
    navigation.navigate('SignUp');
  }, [navigation]);

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.logoWrapper}>
            <Text style={styles.logoIcon}>♪</Text>
            <Text style={styles.logoText}>Music Diary</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.disabledLegend}>Email/password sign in is temporarily disabled.</Text>
          </View>

          <TouchableOpacity
            style={[styles.googleButton, isGoogleLoading && styles.googleButtonDisabled]}
            onPress={handleGoogleSignIn}
            activeOpacity={0.9}
            disabled={isGoogleLoading}
          >
            <View style={styles.googleIconWrapper}>
              <Text style={styles.googleIcon}>G</Text>
            </View>
            {isGoogleLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signupWrapper}>
            <Text style={styles.signupHint}>Don&apos;t have an account?</Text>
            <TouchableOpacity onPress={handleSignUp} hitSlop={8}>
              <Text style={styles.signupLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerIcon}>♪</Text>
          <Text style={styles.footerText}>Music Diary</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.backgroundLight,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 32,
  },
  logoWrapper: {
    gap: 8,
  },
  logoIcon: {
    fontSize: 48,
    color: palette.textPrimaryLight,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: palette.textPrimaryLight,
  },
  form: {
    gap: 20,
  },
  disabledLegend: {
    fontSize: 16,
    color: palette.textSecondaryLight,
  },
  label: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    paddingHorizontal: 16,
    color: '#fff',
    backgroundColor: '#1C1C1E',
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  dividerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#2C2C2E',
  },
  dividerText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  googleButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4285F4',
    borderWidth: 0,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleButtonDisabled: {
    opacity: 0.75,
  },
  googleIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    fontWeight: 'bold',
    color: '#000',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signupWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  signupHint: {
    color: palette.textSecondaryLight,
  },
  signupLink: {
    color: '#4285F4',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 16,
  },
  footerIcon: {
    fontSize: 16,
    color: palette.textSecondaryLight,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimaryLight,
  },
});

