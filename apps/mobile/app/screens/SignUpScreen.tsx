import { useCallback, useState } from 'react';
import {
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

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignUp, useSSO, useClerk } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

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
type SignUpErrorType = 'duplicate_verified' | 'duplicate_unverified' | 'generic_error';

const getSignUpErrorType = (
  errorCode: string | undefined,
  errorMessage: string | undefined,
  errorLongMessage: string | undefined
): SignUpErrorType => {
  if (errorCode === 'form_identifier_exists' || errorMessage?.includes('claimed by another user')) {
    if (errorLongMessage?.includes('verification') || errorMessage?.includes('verification')) {
      return 'duplicate_unverified';
    }
    return 'duplicate_verified';
  }
  return 'generic_error';
};

type RootStackParamList = {
  SignIn: undefined;
  SignUp: { prefillEmail?: string; isVerificationOnly?: boolean } | undefined;
};

type SignUpScreenProps = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export const SignUpScreen = ({ route }: SignUpScreenProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { startSSOFlow } = useSSO();
  const { setActive: setActiveFromClerk } = useClerk();
  const colors = useThemeColors();
  
  const { prefillEmail, isVerificationOnly = false } = route.params || {};
  
  const [emailAddress, setEmailAddress] = useState(prefillEmail || '');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const { ensureConvexUser } = useAuthSetup();

  // Simple email validation regex
  const isValidEmail = useCallback((email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, []);

  const handleSignIn = useCallback(() => {
    navigation.navigate('SignIn');
  }, [navigation]);

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

  const handleGoogleSignUp = useCallback(async () => {
    try {
      setIsGoogleLoading(true);
      const { createdSessionId, setActive: setActiveFromSSO, signIn, signUp } = await startSSOFlow({ strategy: 'oauth_google', redirectUrl });

      const applySession = setActiveFromSSO ?? setActiveFromClerk;

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
      console.error('Google sign up failed', err);
      if (`${err}`.includes("already signed in")) {
        Alert.alert('Already signed in', 'You are already authenticated.');
      } else {
        Alert.alert('Sign up failed', 'Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }, [finalizeSession, setActiveFromClerk, startSSOFlow]);

  const handleAppleSignUp = useCallback(async () => {
    try {
      setIsAppleLoading(true);
      const { createdSessionId, setActive: setActiveFromSSO, signIn, signUp } = await startSSOFlow({ strategy: 'oauth_apple', redirectUrl });

      const applySession = setActiveFromSSO ?? setActiveFromClerk;

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
      console.error('Apple sign up failed', err);
      if (`${err}`.includes("already signed in")) {
        Alert.alert('Already signed in', 'You are already authenticated.');
      } else {
        Alert.alert('Sign up failed', 'Please try again.');
      }
    } finally {
      setIsAppleLoading(false);
    }
  }, [finalizeSession, setActiveFromClerk, startSSOFlow]);

  const handleResendCode = useCallback(async () => {
    if (!isLoaded || !signUp) return;

    try {
      setIsLoading(true);
      
      // Resend verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (err: any) {
      console.error('Resend code failed', err);
      const errorMessage = err?.errors?.[0]?.message || 'Failed to resend code. Please try again.';
      Alert.alert('Resend Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, signUp]);

  const handleSignUp = useCallback(async () => {
    if (!isLoaded) return;

    if (!emailAddress.trim()) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }

    if (!isValidEmail(emailAddress.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    // For verification-only mode, skip password validation
    if (!isVerificationOnly && !password.trim()) {
      Alert.alert('Missing password', 'Please enter a password.');
      return;
    }

    try {
      setIsLoading(true);
      
      if (!signUp) {
        Alert.alert('Error', 'Sign up is not available. Please try again.');
        return;
      }

      if (isVerificationOnly) {
        await signUp.create({
          emailAddress: emailAddress.trim(),
        });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setPendingVerification(true);
      } else {
        await signUp.create({
          emailAddress: emailAddress.trim(),
          password: password.trim(),
        });

        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setPendingVerification(true);
      }
    } catch (err: any) {
      console.error('Sign up failed', err);
      const errorCode = err?.errors?.[0]?.code;
      const errorMessage = err?.errors?.[0]?.message;
      const errorLongMessage = err?.errors?.[0]?.longMessage;

      const errorType = getSignUpErrorType(errorCode, errorMessage, errorLongMessage);

      switch (errorType) {
        case 'duplicate_unverified':
          Alert.alert(
            'Account Already Exists',
            'This email is registered but not verified. Would you like to receive a new verification code?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Send Code',
                onPress: async () => {
                  try {
                    setIsLoading(true);
                    await signUp?.create({ emailAddress: emailAddress.trim() });
                    await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' });
                    setPendingVerification(true);
                  } catch (resendErr: any) {
                    console.error('Failed to resend verification', resendErr);
                    Alert.alert(
                      'Unable to Send Code',
                      'Please try signing in instead or contact support.',
                      [
                        { text: 'OK', style: 'cancel' },
                        { text: 'Go to Sign In', onPress: handleSignIn },
                      ]
                    );
                  } finally {
                    setIsLoading(false);
                  }
                }
              },
            ]
          );
          break;

        case 'duplicate_verified':
          Alert.alert(
            'Account Already Exists',
            'This email is already registered. Please sign in instead.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Go to Sign In', onPress: handleSignIn },
            ]
          );
          break;

        case 'generic_error':
        default:
          Alert.alert('Sign up failed', errorMessage || 'Sign up failed. Please try again.');
          break;
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, emailAddress, password, signUp, handleSignIn, isVerificationOnly, isValidEmail]);

  const handleVerify = useCallback(async () => {
    if (!isLoaded) return;

    if (!code.trim()) {
      Alert.alert('Missing code', 'Please enter the verification code.');
      return;
    }

    try {
      setIsLoading(true);
      
      if (!signUp) {
        Alert.alert('Error', 'Verification is not available. Please try again.');
        return;
      }

      // Use the code the user provided to attempt verification
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      // If verification was completed, set the session to active
      if (signUpAttempt.status === 'complete') {
        await setActive({ session: signUpAttempt.createdSessionId });
        
        // Wait for Clerk JWT token to propagate to Convex
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Ensure user document exists in Convex
        await ensureConvexUser();
      } else {
        // If the status is not complete, check why. User may need to
        // complete further steps.
        console.error('Verification incomplete', JSON.stringify(signUpAttempt, null, 2));
        Alert.alert('Verification incomplete', 'Please try again or contact support.');
      }
    } catch (err: any) {
      console.error('Verification failed', err);
      const errorMessage = err?.errors?.[0]?.message || 'Invalid verification code. Please try again.';
      Alert.alert('Verification failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, code, signUp, setActive, ensureConvexUser]);

  // Show verification form if pending verification
  if (pendingVerification) {
    return (
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={styles.content}>
            <AuthHeader subtitle={`We sent a verification code to ${emailAddress}`} />

            <View style={styles.form}>
              <View>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Verification Code</Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    }
                  ]}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={colors.textMuted}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>

              <PrimaryButton
                onPress={handleVerify}
                text="Verify Email"
                isLoading={isLoading}
              />
            </View>

            <View style={styles.verificationActions}>
              <TouchableOpacity 
                onPress={handleResendCode}
                hitSlop={8}
                disabled={isLoading}
              >
                <Text style={[styles.resendLink, { color: colors.accentMint }, isLoading && styles.linkDisabled]}>
                  Didn&apos;t receive code? Resend
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setPendingVerification(false)}
                hitSlop={8}
                disabled={isLoading}
              >
                <Text style={[styles.backLink, { color: colors.accentMint }, isLoading && styles.linkDisabled]}>
                  ← Back to sign up
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <AuthFooter showIcon={true} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Show sign-up form
  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.content}>
          <AuthHeader 
            subtitle={isVerificationOnly ? `Complete verification for ${emailAddress}` : "Create an Account"} 
            title="eveokee"
            subtitleColor={colors.textPrimary}
            titleColor={colors.accentMint}
          />

          <AuthForm
            email={emailAddress}
            password={password}
            onEmailChange={setEmailAddress}
            onPasswordChange={setPassword}
            showPassword={!isVerificationOnly}
            emailPlaceholder="Enter your email"
            passwordPlaceholder="Create a password"
            disabled={isLoading || isVerificationOnly}
          />

          <PrimaryButton
            onPress={handleSignUp}
            text={isVerificationOnly ? 'Send Verification Code' : 'Continue'}
            isLoading={isLoading}
          />

          <AuthDivider />

          <SocialAuthButtons
            onGooglePress={handleGoogleSignUp}
            onApplePress={handleAppleSignUp}
            isGoogleLoading={isGoogleLoading}
            isAppleLoading={isAppleLoading}
          />

          <AuthNavigationLink
            hint="Already have an account?"
            linkText="Sign in"
            onPress={handleSignIn}
          />
        </View>

        <AuthFooter showIcon={true} />
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
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 32,
  },
  form: {
    gap: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  verificationActions: {
    gap: 16,
    alignItems: 'center',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  backLink: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  linkDisabled: {
    opacity: 0.5,
  },
});

