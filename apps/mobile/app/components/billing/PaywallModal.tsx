import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  reason?: 'limit_reached' | 'signup_prompt' | 'settings' | null;
}

export function PaywallModal({ visible, onClose, reason }: PaywallModalProps) {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (visible) {
      const showPaywall = async () => {
        try {
          // RevenueCat will automatically detect the system theme
          // and display the appropriate paywall configuration
          const paywallResult = await RevenueCatUI.presentPaywall();
          switch (paywallResult) {
            case PAYWALL_RESULT.PURCHASED:
              console.log('Purchase completed successfully');
              onClose();
              break;
            case PAYWALL_RESULT.CANCELLED:
              console.log('Paywall cancelled by user');
              onClose();
              break;
            case PAYWALL_RESULT.ERROR:
              console.error('Paywall error occurred');
              onClose();
              break;
            default:
              onClose();
              break;
          }
        } catch (error) {
          console.error('Paywall error:', error);
          onClose();
        }
      };

      showPaywall();
    }
  }, [visible, onClose, colorScheme]);

  // Return null since RevenueCatUI.presentPaywall() handles the UI
  return null;
}

