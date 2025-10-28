import React from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme/useThemeColors';

interface AuthFormProps {
  email: string;
  password: string;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  showPassword?: boolean;
  emailPlaceholder?: string;
  passwordPlaceholder?: string;
  disabled?: boolean;
}

export const AuthForm = ({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  showPassword = true,
  emailPlaceholder = "Enter your email",
  passwordPlaceholder = "Enter your password",
  disabled = false,
}: AuthFormProps) => {
  const colors = useThemeColors();

  return (
    <View style={styles.form}>
      <View>
        <Text style={[styles.label, { color: colors.textPrimary }]}>Email</Text>
        <TextInput
          style={[
            styles.input, 
            { 
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
            disabled && styles.inputDisabled
          ]}
          placeholder={emailPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={onEmailChange}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!disabled}
        />
      </View>

      {showPassword && (
        <View>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Password</Text>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              }
            ]}
            placeholder={passwordPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!disabled}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
  inputDisabled: {
    opacity: 0.6,
  },
});
