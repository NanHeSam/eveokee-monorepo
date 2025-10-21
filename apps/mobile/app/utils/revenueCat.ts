import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
  PurchasesError,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { Platform } from 'react-native';

// Define the result types for purchase operations
export type PurchaseResult = 
  | { status: 'success'; customerInfo: CustomerInfo }
  | { status: 'cancelled' }
  | { status: 'error'; code?: string; message?: string };

export const configureRevenueCat = async (apiKey: string) => {
  try {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {

      const logLevel = (__DEV__) ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO;
      Purchases.setLogLevel(logLevel);
      Purchases.configure({
        apiKey,
        // Enable automatic theme detection
        shouldShowInAppMessagesAutomatically: true
      });
      console.log(`RevenueCat configured successfully for ${Platform.OS}`);
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
): Promise<PurchaseResult> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    return { status: 'success', customerInfo };
  } catch (error) {
    console.error('Failed to purchase package:', error);
    
    // Check if it's a RevenueCat error with specific error codes
    if (error && typeof error === 'object' && 'code' in error) {
      const purchasesError = error as PurchasesError;
      
      // Check for user cancellation
      if (purchasesError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || 
          purchasesError.userCancelled === true) {
        return { status: 'cancelled' };
      }
      
      // Return error with code and message for other known errors
      return { 
        status: 'error', 
        code: purchasesError.code, 
        message: purchasesError.message 
      };
    }
    
    // For unknown error types, return generic error
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

export const restorePurchases = async (): Promise<PurchaseResult> => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { status: 'success', customerInfo };
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    
    // Check if it's a RevenueCat error with specific error codes
    if (error && typeof error === 'object' && 'code' in error) {
      const purchasesError = error as PurchasesError;
      
      // Check for user cancellation (though less common for restore)
      if (purchasesError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || 
          purchasesError.userCancelled === true) {
        return { status: 'cancelled' };
      }
      
      // Return error with code and message for other known errors
      return { 
        status: 'error', 
        code: purchasesError.code, 
        message: purchasesError.message 
      };
    }
    
    // For unknown error types, return generic error
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
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
    // Re-throw the error so callers can handle it and implement retry logic
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await Purchases.logOut();
    console.log('User logged out from RevenueCat');
  } catch (error) {
    console.error('Failed to logout user:', error);
    // Re-throw the error so callers can handle it and implement retry logic
    throw error;
  }
};
