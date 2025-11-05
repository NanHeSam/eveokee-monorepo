import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSSO, useClerk, useSignIn } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthSetup } from '../hooks/useAuthSetup';
import { AuthHeader } from '../components/auth/AuthHeader';
import { AuthForm } from '../components/auth/AuthForm';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import { AuthDivider } from '../components/auth/AuthDivider';
import { SocialAuthButtons } from '../components/auth/SocialAuthButtons';
import { AuthNavigationLink } from '../components/auth/AuthNavigationLink';
import { AuthFooter } from '../components/auth/AuthFooter';
import { useThemeColors } from '../theme/useThemeColors';

WebBrowser.maybeCompleteAuthSession();

const redirectUrl = AuthSession.makeRedirectUri({
  scheme: "eveokee",
  path: "oauth-native-callback",
});

// Error handling helpers
type SignInErrorType = 'wrong_password' | 'generic_error';

const getSignInErrorType = (
  errorCode: string | undefined,
  errorMessage: string | undefined,
  errorLongMessage: string | undefined
): SignInErrorType => {
  if (errorCode === 'form_password_incorrect' || errorCode?.startsWith('form_password_')) {
    return 'wrong_password';
  }
  
  return 'generic_error';
};

const handleSignInError = (
  errorType: SignInErrorType
) => {
  switch (errorType) {
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
  const colors = useThemeColors();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

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
      } else {
        console.log('Sign in status:', result.status);
        Alert.alert('Sign in incomplete', 'Please complete the sign in process.');
      }
    } catch (err: any) {
      console.error('Password sign in failed', err);
      
      const errorCode = err?.errors?.[0]?.code || err?.code;
      const errorMessage = err?.errors?.[0]?.message || err?.message || err?.toString();
      const errorLongMessage = err?.errors?.[0]?.longMessage || err?.longMessage;
      
      console.log('Error details:', { errorCode, errorMessage, errorLongMessage });
      
      const errorType = getSignInErrorType(errorCode, errorMessage, errorLongMessage);
      handleSignInError(errorType);
    } finally {
      setIsPasswordLoading(false);
    }
  }, [identifier, password, signIn, setActive, finalizeSession]);

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
  }, [finalizeSession, setActive, startSSOFlow]);

  const handleAppleSignIn = useCallback(async () => {
    try {
      setIsAppleLoading(true);
      const { createdSessionId, setActive: setActiveFromSSO, signIn, signUp } = await startSSOFlow({ strategy: 'oauth_apple', redirectUrl });

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
      console.error('Apple sign in failed', err);
      if (`${err}`.includes("already signed in")) {
        Alert.alert('Already signed in', 'You are already authenticated.');
      } else {
        Alert.alert('Sign in failed', 'Please try again.');
      }
    } finally {
      setIsAppleLoading(false);
    }
  }, [finalizeSession, setActive, startSSOFlow]);

  const handleSignUp = useCallback(() => {
    navigation.navigate('SignUp');
  }, [navigation]);

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <AuthHeader 
              subtitle="Login to" 
              title="eveokee"
              subtitleColor={colors.textPrimary}
              titleColor={colors.accentMint}
            />

            <AuthForm
              email={identifier}
              password={password}
              onEmailChange={setIdentifier}
              onPasswordChange={setPassword}
              showPassword={true}
              emailPlaceholder="Enter your email"
              passwordPlaceholder="Enter your password"
              disabled={isPasswordLoading}
            />

            <PrimaryButton
              onPress={handlePasswordSignIn}
              text="Sign In"
              isLoading={isPasswordLoading}
            />

            <AuthDivider />

            <SocialAuthButtons
              onGooglePress={handleGoogleSignIn}
              onApplePress={handleAppleSignIn}
              isGoogleLoading={isGoogleLoading}
              isAppleLoading={isAppleLoading}
            />

            <AuthNavigationLink
              hint="Don't have an account?"
              linkText="Sign up"
              onPress={handleSignUp}
            />
          </View>

          <View style={styles.footerWrapper}>
            <AuthFooter showIcon={true} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 32,
    minHeight: 400,
  },
  footerWrapper: {
    marginTop: 'auto',
    paddingTop: 20,
  },
});

