import { useState, useEffect } from 'react';
import Purchases, { PurchasesOffering, PurchasesPackage, CustomerInfo } from 'react-native-purchases';

export function useRevenueCat() {
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);
  const [loadingCustomerInfo, setLoadingCustomerInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeData = async () => {
      try {
        // Note: User identification is handled by useRevenueCatSync hook in App.tsx
        // This hook only loads offerings and customer info
        
        // Set both loading states for initial load
        setLoadingOfferings(true);
        setLoadingCustomerInfo(true);
        
        // Load both offerings and customer info
        const [offerings, customerInfo] = await Promise.all([
          Purchases.getOfferings(),
          Purchases.getCustomerInfo()
        ]);

        if (offerings.current) {
          setOfferings(offerings.current);
        }
        setCustomerInfo(customerInfo);
      } catch (e) {
        setError('Failed to load RevenueCat data');
        console.error('Failed to load RevenueCat data:', e);
      } finally {
        setLoadingOfferings(false);
        setLoadingCustomerInfo(false);
      }
    };

    initializeData();
  }, []);

  const loadOfferings = async () => {
    try {
      setLoadingOfferings(true);
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setOfferings(offerings.current);
      }
    } catch (e) {
      setError('Failed to load offerings');
      console.error('Failed to load offerings:', e);
    } finally {
      setLoadingOfferings(false);
    }
  };

  const loadCustomerInfo = async () => {
    try {
      setLoadingCustomerInfo(true);
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (e) {
      setError('Failed to load customer info');
      console.error('Failed to load customer info:', e);
    } finally {
      setLoadingCustomerInfo(false);
    }
  };

  const purchasePackage = async (packageToPurchase: PurchasesPackage) => {
    try {
      setLoadingPurchase(true);
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      setCustomerInfo(customerInfo);
      await loadCustomerInfo();
      return { success: true, customerInfo };
    } catch (e: any) {
      if (e.userCancelled) {
        return { success: false, error: 'Purchase cancelled' };
      }
      setError('Purchase failed');
      console.error('Purchase failed:', e);
      return { success: false, error: 'Purchase failed' };
    } finally {
      setLoadingPurchase(false);
    }
  };

  const restorePurchases = async () => {
    try {
      setLoadingRestore(true);
      const customerInfo = await Purchases.restorePurchases();
      setCustomerInfo(customerInfo);
      return { success: true, customerInfo };
    } catch (e) {
      setError('Failed to restore purchases');
      console.error('Failed to restore purchases:', e);
      return { success: false, error: 'Failed to restore purchases' };
    } finally {
      setLoadingRestore(false);
    }
  };

  const hasActiveSubscription = () => {
    if (!customerInfo) return false;
    return Object.keys(customerInfo.entitlements.active).length > 0;
  };

  // Computed loading state for backward compatibility
  const loading = loadingOfferings || loadingPurchase || loadingRestore || loadingCustomerInfo;

  return {
    offerings,
    customerInfo,
    // Individual loading states for granular control
    loadingOfferings,
    loadingPurchase,
    loadingRestore,
    loadingCustomerInfo,
    // Computed loading state for backward compatibility
    loading,
    error,
    loadOfferings,
    loadCustomerInfo,
    purchasePackage,
    restorePurchases,
    hasActiveSubscription: hasActiveSubscription(),
  };
}
