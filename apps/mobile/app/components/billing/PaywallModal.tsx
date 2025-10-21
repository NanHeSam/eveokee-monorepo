import { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchased?: () => void;
  reason?: 'limit_reached' | 'signup_prompt' | 'settings' | null;
}

export function PaywallModal({ visible, onClose, onPurchased }: PaywallModalProps) {
  const isPresentingRef = useRef(false);

  useEffect(() => {
    if (visible && !isPresentingRef.current) {
      const showPaywall = async () => {
        isPresentingRef.current = true;
        try {
          // RevenueCat will automatically detect the system theme
          // and display the appropriate paywall configuration
          const paywallResult = await RevenueCatUI.presentPaywall();
          switch (paywallResult) {
            case PAYWALL_RESULT.PURCHASED:
              console.log('Purchase completed successfully');
              onPurchased?.();
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
        } finally {
          isPresentingRef.current = false;
        }
      };

      showPaywall();
    }
  }, [visible, onClose, onPurchased]);

  // Return null since RevenueCatUI.presentPaywall() handles the UI
  return null;
}

