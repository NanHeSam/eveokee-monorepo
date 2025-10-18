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

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignUp } from '@clerk/clerk-expo';

import { palette } from '../theme/colors';
import { useAuthSetup } from '../hooks/useAuthSetup';

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
  
  const { prefillEmail, isVerificationOnly = false } = route.params || {};
  
  const [emailAddress, setEmailAddress] = useState(prefillEmail || '');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { ensureConvexUser } = useAuthSetup();

  // Simple email validation regex
  const isValidEmail = useCallback((email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, []);

  const handleSignIn = useCallback(() => {
    navigation.navigate('SignIn');
  }, [navigation]);

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
                    // For unverified accounts, just send verification code
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
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={styles.content}>
            <View style={styles.logoWrapper}>
              <Text style={styles.logoIcon}>♪</Text>
              <Text style={styles.logoText}>Verify Your Email</Text>
              <Text style={styles.logoSubtext}>
                We sent a verification code to {emailAddress}
              </Text>
            </View>

            <View style={styles.form}>
              <View>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor="#999"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                onPress={handleVerify}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify Email</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.verificationActions}>
              <TouchableOpacity 
                onPress={handleResendCode}
                hitSlop={8}
                disabled={isLoading}
              >
                <Text style={[styles.resendLink, isLoading && styles.linkDisabled]}>
                  Didn&apos;t receive code? Resend
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setPendingVerification(false)}
                hitSlop={8}
                disabled={isLoading}
              >
                <Text style={[styles.backLink, isLoading && styles.linkDisabled]}>
                  ← Back to sign up
                </Text>
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
  }

  // Show sign-up form
  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.logoWrapper}>
            <Text style={styles.logoIcon}>♪</Text>
            <Text style={styles.logoText}>
              {isVerificationOnly ? 'Verify Your Account' : 'Create Account'}
            </Text>
            {isVerificationOnly && (
              <Text style={styles.logoSubtext}>
                Complete verification for {emailAddress}
              </Text>
            )}
          </View>

          <View style={styles.form}>
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, isVerificationOnly && styles.inputDisabled]}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!isLoading && !isVerificationOnly}
              />
            </View>

            {!isVerificationOnly && (
              <View>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Create a password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
              onPress={handleSignUp}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isVerificationOnly ? 'Send Verification Code' : 'Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.signInWrapper}>
            <Text style={styles.signInHint}>Already have an account?</Text>
            <TouchableOpacity onPress={handleSignIn} hitSlop={8}>
              <Text style={styles.signInLink}>Sign in</Text>
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
  logoSubtext: {
    fontSize: 14,
    color: palette.textSecondaryLight,
    marginTop: 4,
  },
  form: {
    gap: 20,
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
  inputDisabled: {
    backgroundColor: '#E5E5EA',
    color: '#8E8E93',
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
  signInWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  signInHint: {
    color: palette.textSecondaryLight,
  },
  signInLink: {
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
  verificationActions: {
    gap: 16,
    alignItems: 'center',
  },
  resendLink: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '500',
    textAlign: 'center',
  },
  backLink: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '600',
    textAlign: 'center',
  },
  linkDisabled: {
    opacity: 0.5,
  },
});

