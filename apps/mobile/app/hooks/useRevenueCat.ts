import { useState, useEffect } from 'react';
import Purchases, { PurchasesOffering, PurchasesPackage, CustomerInfo } from 'react-native-purchases';

export function useRevenueCat() {
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeData = async () => {
      try {
        // Note: User identification is handled by useRevenueCatSync hook in App.tsx
        // This hook only loads offerings and customer info
        
        // Load offerings
        try {
          const offerings = await Purchases.getOfferings();
          if (offerings.current) {
            setOfferings(offerings.current);
          }
        } catch (e) {
          setError('Failed to load offerings');
          console.error('Failed to load offerings:', e);
        } finally {
          setLoading(false);
        }

        // Load customer info
        try {
          const info = await Purchases.getCustomerInfo();
          setCustomerInfo(info);
        } catch (e) {
          console.error('Failed to load customer info:', e);
        }
      } catch (e) {
        console.error('Failed to load RevenueCat data:', e);
        setError('Failed to load data');
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  const loadOfferings = async () => {
    try {
      setLoading(true);
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setOfferings(offerings.current);
      }
    } catch (e) {
      setError('Failed to load offerings');
      console.error('Failed to load offerings:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerInfo = async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (e) {
      setError('Failed to load customer info');
      console.error('Failed to load customer info:', e);
    }
  };

  const purchasePackage = async (packageToPurchase: PurchasesPackage) => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  const restorePurchases = async () => {
    try {
      setLoading(true);
      const customerInfo = await Purchases.restorePurchases();
      setCustomerInfo(customerInfo);
      return { success: true, customerInfo };
    } catch (e) {
      setError('Failed to restore purchases');
      console.error('Failed to restore purchases:', e);
      return { success: false, error: 'Failed to restore purchases' };
    } finally {
      setLoading(false);
    }
  };

  const hasActiveSubscription = () => {
    if (!customerInfo) return false;
    return Object.keys(customerInfo.entitlements.active).length > 0;
  };

  return {
    offerings,
    customerInfo,
    loading,
    error,
    loadOfferings,
    loadCustomerInfo,
    purchasePackage,
    restorePurchases,
    hasActiveSubscription: hasActiveSubscription(),
  };
}
