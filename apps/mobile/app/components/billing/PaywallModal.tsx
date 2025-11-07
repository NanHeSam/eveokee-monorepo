import { useEffect, useRef } from 'react';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import * as Sentry from '@sentry/react-native';

// Module-level singleton to track paywall presentation globally
// This prevents double presentation even if multiple PaywallModal instances exist
let globalIsPresenting = false;
let globalHasPresented = false;

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchased?: () => void;
  reason?: 'limit_reached' | 'signup_prompt' | 'settings' | null;
}

export function PaywallModal({ visible, onClose, onPurchased, reason }: PaywallModalProps) {
  const onCloseRef = useRef(onClose);
  const onPurchasedRef = useRef(onPurchased);
  const reasonRef = useRef(reason);

  // Update refs when callbacks change
  onCloseRef.current = onClose;
  onPurchasedRef.current = onPurchased;
  reasonRef.current = reason;

  useEffect(() => {
    // Reset guards when visible becomes false
    if (!visible) {
      // Reset after a delay to ensure paywall is fully closed
      const resetTimeout = setTimeout(() => {
        globalIsPresenting = false;
        globalHasPresented = false;
      }, 1000); // Increased delay to ensure paywall is fully dismissed
      return () => clearTimeout(resetTimeout);
    }

    // Only show paywall if:
    // 1. visible is true
    // 2. We're not already presenting globally
    // 3. We haven't already presented globally (prevents double presentation)
    if (visible && !globalIsPresenting && !globalHasPresented) {
      const showPaywall = async () => {
        globalIsPresenting = true;
        globalHasPresented = true;
        try {
          Sentry.addBreadcrumb({
            category: 'revenuecat',
            level: 'info',
            message: 'presentPaywall:start',
            data: {
              reason: reasonRef.current ?? 'unknown',
            },
          });
          // RevenueCat will automatically detect the system theme
          // and display the appropriate paywall configuration
          const paywallResult = await RevenueCatUI.presentPaywall();
          Sentry.addBreadcrumb({
            category: 'revenuecat',
            level: 'info',
            message: 'presentPaywall:result',
            data: {
              result: paywallResult,
            },
          });
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
              Sentry.captureMessage('RevenueCat paywall returned ERROR result', 'error');
              onCloseRef.current();
              break;
            default:
              onCloseRef.current();
              break;
          }
        } catch (error) {
          console.error('Paywall error:', error);
          Sentry.captureException(error);
          onCloseRef.current();
        } finally {
          // Only reset isPresenting, keep hasPresented true to prevent double presentation
          globalIsPresenting = false;
        }
      };

      showPaywall();
    }
  }, [visible]);

  // Return null since RevenueCatUI.presentPaywall() handles the UI
  return null;
}
