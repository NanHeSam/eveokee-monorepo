import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSSO, useClerk, useSignIn } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { palette } from '../theme/colors';
import { useAuthSetup } from '../hooks/useAuthSetup';

WebBrowser.maybeCompleteAuthSession();

const redirectUrl = AuthSession.makeRedirectUri({
  scheme: "eveokee",
  path: "oauth-native-callback",
});

// Error handling helpers
type SignInErrorType = 'unverified_account' | 'wrong_password' | 'generic_error';

const getSignInErrorType = (
  errorCode: string | undefined,
  errorMessage: string | undefined,
  errorLongMessage: string | undefined
): SignInErrorType => {
  // Strategy 1: Use Clerk's error code prefixes (most reliable)
  if (errorCode) {
    if (errorCode.startsWith('form_identifier_')) {
      return 'unverified_account';
    }
    if (errorCode.startsWith('form_password_')) {
      return 'wrong_password';
    }
  }
  
  // Strategy 2: Check if we have a sign-in result that indicates unverified account
  // This is more reliable than parsing error messages
  if (errorMessage && errorMessage.includes('Couldn\'t find your account')) {
    // This specific error from Clerk usually means unverified account
    return 'unverified_account';
  }
  
  // Strategy 3: Minimal fallback - only check for very stable keywords
  if (errorMessage || errorLongMessage) {
    const message = `${errorMessage || ''} ${errorLongMessage || ''}`.toLowerCase();
    if (message.includes('verification') || message.includes('unverified')) {
      return 'unverified_account';
    }
  }
  
  return 'generic_error';
};

const handleSignInError = (
  errorType: SignInErrorType,
  email: string,
  navigation: NativeStackNavigationProp<RootStackParamList>
) => {
  switch (errorType) {
    case 'unverified_account':
      Alert.alert(
        'Account Not Verified',
        'Your account exists but hasn\'t been verified yet. Please complete the sign-up process by verifying your email.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Sign Up', onPress: () => navigation.navigate('SignUp', { 
            prefillEmail: email,
            isVerificationOnly: true 
          }) },
        ]
      );
      break;
      
    case 'wrong_password':
      Alert.alert('Sign in failed', 'Incorrect password. Please try again.');
      break;
      
    case 'generic_error':
    default:
      Alert.alert('Sign in failed', 'Unable to sign in. Please check your credentials and try again.');
      break;
  }
};
type RootStackParamList = {
  SignIn: undefined;
  SignUp: { prefillEmail?: string; isVerificationOnly?: boolean } | undefined;
  Home: undefined;
};

export const SignInScreen = () => {
  const { setActive } = useClerk();
  const { startSSOFlow } = useSSO();
  const { signIn } = useSignIn();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const { ensureConvexUser } = useAuthSetup();

  const finalizeSession = useCallback(
    async (
      applySession: ReturnType<typeof useClerk>['setActive'] | null,
      sessionId: string | null | undefined,
    ) => {
      if (!sessionId) {
        return false;
      }

      await applySession?.({ session: sessionId });

      // Wait for Clerk JWT token to propagate to Convex
      await new Promise(resolve => setTimeout(resolve, 300));

      await ensureConvexUser();

      return true;
    },
    [ensureConvexUser],
  );

  const handlePasswordSignIn = useCallback(async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter both email and password.');
      return;
    }

    try {
      setIsPasswordLoading(true);
      
      if (!signIn) {
        Alert.alert('Error', 'Sign in is not available. Please try again.');
        return;
      }

      const result = await signIn.create({
        identifier: identifier.trim(),
        password: password.trim(),
      });

      if (result.status === 'complete') {
        await finalizeSession(setActive, result.createdSessionId);
      } else if (result.status === 'needs_first_factor') {
        // Account exists but might need verification or 2FA
        Alert.alert(
          'Verification Required',
          'Please complete account verification. Go to Sign Up to receive a new verification code.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go to Sign Up', onPress: () => navigation.navigate('SignUp', { 
              prefillEmail: identifier.trim(),
              isVerificationOnly: true 
            }) },
          ]
        );
      } else {
        // Other incomplete statuses
        console.log('Sign in status:', result.status);
        Alert.alert('Sign in incomplete', 'Please complete the sign in process.');
      }
    } catch (err: any) {
      console.error('Password sign in failed', err);
      
      // Extract error information from different possible structures
      const errorCode = err?.errors?.[0]?.code || err?.code;
      const errorMessage = err?.errors?.[0]?.message || err?.message || err?.toString();
      const errorLongMessage = err?.errors?.[0]?.longMessage || err?.longMessage;
      
      console.log('Error details:', { errorCode, errorMessage, errorLongMessage });
      
      // Determine error type and show appropriate message
      const errorType = getSignInErrorType(errorCode, errorMessage, errorLongMessage);
      handleSignInError(errorType, identifier.trim(), navigation);
    } finally {
      setIsPasswordLoading(false);
    }
  }, [identifier, password, signIn, setActive, finalizeSession, navigation]);

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
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!isPasswordLoading}
              />
            </View>

            <View>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isPasswordLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isPasswordLoading && styles.primaryButtonDisabled]}
              onPress={handlePasswordSignIn}
              activeOpacity={0.8}
              disabled={isPasswordLoading}
            >
              {isPasswordLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.dividerWrapper}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
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
    color: palette.textPrimaryLight,
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    paddingHorizontal: 16,
    color: palette.textPrimaryLight,
    backgroundColor: '#F2F2F7',
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

