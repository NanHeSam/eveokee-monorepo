import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { palette } from '../theme/colors';

type RootStackParamList = {
  SignIn: undefined;
};

export const SignUpScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.logoWrapper}>
            <Text style={styles.logoIcon}>♪</Text>
            <Text style={styles.logoText}>Sign up is coming soon</Text>
            <Text style={styles.bodyText}>
              We are polishing the email sign up experience. In the meantime, sign in with
              Google to continue exploring Music Diary.
            </Text>
          </View>

          <Text style={styles.helperText} onPress={() => navigation.navigate('SignIn')}>
            Back to Sign In
          </Text>
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
    paddingVertical: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  logoWrapper: {
    alignItems: 'center',
    gap: 16,
  },
  logoIcon: {
    fontSize: 48,
    color: palette.textPrimaryLight,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '600',
    color: palette.textPrimaryLight,
    textAlign: 'center',
  },
  bodyText: {
    color: palette.textSecondaryLight,
    fontSize: 16,
    textAlign: 'center',
  },
  helperText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

