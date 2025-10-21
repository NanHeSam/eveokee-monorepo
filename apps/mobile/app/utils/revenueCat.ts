import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';

export const configureRevenueCat = async (apiKey: string) => {
  try {
    if (Platform.OS === 'ios') {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
      Purchases.configure({
        apiKey,
        // Enable automatic theme detection
        shouldShowInAppMessagesAutomatically: true
      });
      console.log('RevenueCat configured successfully for iOS');
    } else if (Platform.OS === 'android') {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({
        apiKey,
        // Enable automatic theme detection
        shouldShowInAppMessagesAutomatically: true
      });
      console.log('RevenueCat configured successfully for Android');
    } else {
      console.warn('RevenueCat is only supported on iOS and Android');
    }
  } catch (error) {
    console.error('Failed to configure RevenueCat:', error);
    throw error;
  }
};

export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Failed to get customer info:', error);
    return null;
  }
};

export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null) {
      return offerings.current;
    }
    return null;
  } catch (error) {
    console.error('Failed to get offerings:', error);
    return null;
  }
};

export const purchasePackage = async (
  packageToPurchase: PurchasesPackage
): Promise<CustomerInfo | null> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    return customerInfo;
  } catch (error) {
    console.error('Failed to purchase package:', error);
    return null;
  }
};

export const restorePurchases = async (): Promise<CustomerInfo | null> => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    return null;
  }
};

export const checkSubscriptionStatus = async (
  entitlementIdentifier: string
): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return (
      typeof customerInfo.entitlements.active[entitlementIdentifier] !==
      'undefined'
    );
  } catch (error) {
    console.error('Failed to check subscription status:', error);
    return false;
  }
};

export const identifyUser = async (userId: string) => {
  try {
    await Purchases.logIn(userId);
    console.log('User identified in RevenueCat:', userId);
  } catch (error) {
    console.error('Failed to identify user:', error);
  }
};

export const logoutUser = async () => {
  try {
    await Purchases.logOut();
    console.log('User logged out from RevenueCat');
  } catch (error) {
    console.error('Failed to logout user:', error);
  }
};
