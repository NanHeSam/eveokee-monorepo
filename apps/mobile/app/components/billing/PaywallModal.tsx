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
  const onCloseRef = useRef(onClose);
  const onPurchasedRef = useRef(onPurchased);

  // Update refs when callbacks change
  onCloseRef.current = onClose;
  onPurchasedRef.current = onPurchased;

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
              onPurchasedRef.current?.();
              onCloseRef.current();
              break;
            case PAYWALL_RESULT.CANCELLED:
              console.log('Paywall cancelled by user');
              onCloseRef.current();
              break;
            case PAYWALL_RESULT.ERROR:
              console.error('Paywall error occurred');
              onCloseRef.current();
              break;
            default:
              onCloseRef.current();
              break;
          }
        } catch (error) {
          console.error('Paywall error:', error);
          onCloseRef.current();
        } finally {
          isPresentingRef.current = false;
        }
      };

      showPaywall();
    }
  }, [visible]);

  // Return null since RevenueCatUI.presentPaywall() handles the UI
  return null;
}

