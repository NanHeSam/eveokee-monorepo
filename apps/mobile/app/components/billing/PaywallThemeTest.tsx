import React from 'react';
import { View, Text, TouchableOpacity, Alert, useColorScheme } from 'react-native';
import { useThemeColors } from '../../theme/useThemeColors';
import { useSubscriptionUIStore } from '../../store/useSubscriptionStore';

/**
 * Test component to verify paywall theme functionality
 * This component can be temporarily added to a screen for testing
 */
export function PaywallThemeTest() {
  const colorScheme = useColorScheme();
  const colors = useThemeColors();
  const { setShowPaywall } = useSubscriptionUIStore();

  const handleTestPaywall = () => {
    setShowPaywall(true, 'settings');
  };

  const handleShowThemeInfo = () => {
    Alert.alert(
      'Theme Information',
      `Current Color Scheme: ${colorScheme}\n\nApp Theme Colors:\nBackground: ${colors.background}\nSurface: ${colors.surface}\nText Primary: ${colors.textPrimary}\nAccent: ${colors.accentMint}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={{ 
      padding: 16, 
      backgroundColor: colors.surface,
      borderRadius: 8,
      margin: 16,
      borderWidth: 1,
      borderColor: colors.border
    }}>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: colors.textPrimary,
        marginBottom: 8
      }}>
        Paywall Theme Test
      </Text>
      
      <Text style={{ 
        color: colors.textSecondary,
        marginBottom: 16
      }}>
        Current theme: {colorScheme || 'unknown'}
      </Text>

      <TouchableOpacity
        onPress={handleTestPaywall}
        style={{
          backgroundColor: colors.accentMint,
          padding: 12,
          borderRadius: 6,
          marginBottom: 8
        }}
      >
        <Text style={{ 
          color: 'white', 
          textAlign: 'center',
          fontWeight: '600'
        }}>
          Test Paywall
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleShowThemeInfo}
        style={{
          backgroundColor: colors.card,
          padding: 12,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: colors.border
        }}
      >
        <Text style={{ 
          color: colors.textPrimary, 
          textAlign: 'center',
          fontWeight: '500'
        }}>
          Show Theme Info
        </Text>
      </TouchableOpacity>
    </View>
  );
}

