import { useState, useEffect } from 'react';
import Purchases, { PurchasesOffering, PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { useMutation } from 'convex/react';
import { api } from '@backend/convex';

export function useRevenueCat() {
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const { userId } = await ensureCurrentUser({});
        await Purchases.logIn(userId);
        await loadOfferings();
        await loadCustomerInfo();
      } catch (e) {
        console.error('Failed to initialize user:', e);
        setError('Failed to initialize');
        setLoading(false);
      }
    };
    
    initializeUser();
  }, []);

  const loadOfferings = async () => {
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
  };

  const loadCustomerInfo = async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (e) {
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
    purchasePackage,
    restorePurchases,
    hasActiveSubscription: hasActiveSubscription(),
  };
}
