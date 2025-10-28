 
import type {
  CustomerInfo,
  LOG_LEVEL as LogLevelEnum,
  PurchasesError,
  PurchasesOffering,
  PurchasesOfferings,
  PurchasesPackage,
  MakePurchaseResult,
  PURCHASES_ERROR_CODE as PurchaseErrorCode,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE } from 'react-native-purchases';
import {
  configureRevenueCat,
  getCustomerInfo,
  getOfferings,
  purchasePackage,
  restorePurchases,
  checkSubscriptionStatus,
  identifyUser,
  logoutUser,
} from '../revenueCat';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-purchases', () => {
  const mockPurchases = {
    setLogLevel: jest.fn(),
    configure: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
  };

  const LOG_LEVEL = {
    DEBUG: 'DEBUG' as LogLevelEnum,
    INFO: 'INFO' as LogLevelEnum,
  } as const;

  const PURCHASES_ERROR_CODE = {
    UNKNOWN_ERROR: '0' as PurchaseErrorCode,
    PURCHASE_CANCELLED_ERROR: '1' as PurchaseErrorCode,
    STORE_PROBLEM_ERROR: '2' as PurchaseErrorCode,
    CUSTOMER_INFO_ERROR: '29' as PurchaseErrorCode,
  } as const;

  return {
    __esModule: true,
    default: mockPurchases,
    LOG_LEVEL,
    PURCHASES_ERROR_CODE,
  };
});

const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;
const globalWithDev = globalThis as typeof globalThis & { __DEV__?: boolean };

describe('revenueCat utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });

  describe('configureRevenueCat', () => {
    it('configures RevenueCat on supported platforms', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await configureRevenueCat('test-key');

      expect(mockPurchases.setLogLevel).toHaveBeenCalledWith(LOG_LEVEL.DEBUG);
      expect(mockPurchases.configure).toHaveBeenCalledWith({
        apiKey: 'test-key',
        shouldShowInAppMessagesAutomatically: true,
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('RevenueCat configured successfully for ios'),
      );

      logSpy.mockRestore();
    });

    it('uses INFO log level outside of development', async () => {
      const originalDev = globalWithDev.__DEV__;
      Object.defineProperty(globalWithDev, '__DEV__', { value: false, configurable: true });
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await configureRevenueCat('prod-key');

      expect(mockPurchases.setLogLevel).toHaveBeenCalledWith(LOG_LEVEL.INFO);
      expect(mockPurchases.configure).toHaveBeenCalledWith({
        apiKey: 'prod-key',
        shouldShowInAppMessagesAutomatically: true,
      });

      logSpy.mockRestore();
      if (typeof originalDev === 'undefined') {
        delete globalWithDev.__DEV__;
      } else {
        Object.defineProperty(globalWithDev, '__DEV__', {
          value: originalDev,
          configurable: true,
        });
      }
    });

    it('warns on unsupported platforms', async () => {
      Platform.OS = 'web';
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await configureRevenueCat('web-key');

      expect(mockPurchases.configure).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'RevenueCat is only supported on iOS and Android',
      );

      warnSpy.mockRestore();
    });

    it('propagates configuration errors', async () => {
      const error = new Error('configuration failed');
      mockPurchases.configure.mockImplementationOnce(() => {
        throw error;
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(configureRevenueCat('bad-key')).rejects.toThrow(error);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to configure RevenueCat:',
        error,
      );

      errorSpy.mockRestore();
    });
  });

  describe('getCustomerInfo', () => {
    it('returns customer info when available', async () => {
      const customerInfo = { id: 'user-1' } as unknown as CustomerInfo;
      mockPurchases.getCustomerInfo.mockResolvedValueOnce(customerInfo);

      await expect(getCustomerInfo()).resolves.toBe(customerInfo);
      expect(mockPurchases.getCustomerInfo).toHaveBeenCalled();
    });

    it('returns null when fetching fails', async () => {
      const error = new Error('network down');
      mockPurchases.getCustomerInfo.mockRejectedValueOnce(error);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getCustomerInfo()).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('Failed to get customer info:', error);

      errorSpy.mockRestore();
    });
  });

  describe('getOfferings', () => {
    it('returns current offering when available', async () => {
      const currentOffering = { identifier: 'premium' } as unknown as PurchasesOffering;
      mockPurchases.getOfferings.mockResolvedValueOnce({
        current: currentOffering,
        all: {},
      } as PurchasesOfferings);

      const offering = await getOfferings();

      expect(offering).toBe(currentOffering);
      expect(mockPurchases.getOfferings).toHaveBeenCalled();
    });

    it('returns null when no current offering exists', async () => {
      mockPurchases.getOfferings.mockResolvedValueOnce({
        current: null,
        all: {},
      } as PurchasesOfferings);

      await expect(getOfferings()).resolves.toBeNull();
    });

    it('returns null when fetching offerings fails', async () => {
      const error = new Error('fetch failed');
      mockPurchases.getOfferings.mockRejectedValueOnce(error);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getOfferings()).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('Failed to get offerings:', error);

      errorSpy.mockRestore();
    });
  });

  describe('purchasePackage', () => {
    const packageMock = {} as PurchasesPackage;
    const customerInfo = { id: 'user-1' } as unknown as CustomerInfo;

    it('returns success when purchase completes', async () => {
      mockPurchases.purchasePackage.mockResolvedValueOnce({
        customerInfo,
        productIdentifier: 'test-product',
        transaction: null,
      } as MakePurchaseResult);

      const result = await purchasePackage(packageMock);

      expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(packageMock);
      expect(result).toEqual({ status: 'success', customerInfo });
    });

    it('returns cancelled when user cancels via error code', async () => {
      const error: Partial<PurchasesError> = {
        code: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR,
        message: 'User cancelled',
      };
      mockPurchases.purchasePackage.mockRejectedValueOnce(error);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await purchasePackage(packageMock);

      expect(result).toEqual({ status: 'cancelled' });
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to purchase package:',
        error,
      );

      errorSpy.mockRestore();
    });

    it('returns cancelled when userCancelled flag is true', async () => {
      const error: Partial<PurchasesError> = {
        code: PURCHASES_ERROR_CODE.UNKNOWN_ERROR,
        userCancelled: true,
        message: 'cancelled',
      };
      mockPurchases.purchasePackage.mockRejectedValueOnce(error);

      const result = await purchasePackage(packageMock);

      expect(result).toEqual({ status: 'cancelled' });
    });

    it('returns error details for known errors', async () => {
      const error: Partial<PurchasesError> = {
        code: PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR,
        message: 'Billing issue',
      };
      mockPurchases.purchasePackage.mockRejectedValueOnce(error);

      const result = await purchasePackage(packageMock);

      expect(result).toEqual({
        status: 'error',
        code: PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR,
        message: 'Billing issue',
      });
    });

    it('returns generic error for unknown error types', async () => {
      const error = new Error('Unknown failure');
      mockPurchases.purchasePackage.mockRejectedValueOnce(error);

      const result = await purchasePackage(packageMock);

      expect(result).toEqual({
        status: 'error',
        message: 'Unknown failure',
      });
    });
  });

  describe('restorePurchases', () => {
    const customerInfo = { id: 'restored-user' } as unknown as CustomerInfo;

    it('returns success when restore completes', async () => {
      mockPurchases.restorePurchases.mockResolvedValueOnce(customerInfo);

      const result = await restorePurchases();

      expect(result).toEqual({ status: 'success', customerInfo });
    });

    it('returns cancelled when restore is cancelled', async () => {
      const error: Partial<PurchasesError> = {
        code: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR,
      };
      mockPurchases.restorePurchases.mockRejectedValueOnce(error);

      const result = await restorePurchases();

      expect(result).toEqual({ status: 'cancelled' });
    });

    it('returns error with code and message when available', async () => {
      const error: Partial<PurchasesError> = {
        code: PURCHASES_ERROR_CODE.CUSTOMER_INFO_ERROR,
        message: 'restore failed',
      };
      mockPurchases.restorePurchases.mockRejectedValueOnce(error);

      const result = await restorePurchases();

      expect(result).toEqual({
        status: 'error',
        code: PURCHASES_ERROR_CODE.CUSTOMER_INFO_ERROR,
        message: 'restore failed',
      });
    });

    it('returns generic error when restore fails unexpectedly', async () => {
      const error = new Error('boom');
      mockPurchases.restorePurchases.mockRejectedValueOnce(error);

      const result = await restorePurchases();

      expect(result).toEqual({
        status: 'error',
        message: 'boom',
      });
    });
  });

  describe('checkSubscriptionStatus', () => {
    it('returns true when entitlement is active', async () => {
      const customerInfo = {
        entitlements: { active: { premium: {} } },
      } as unknown as CustomerInfo;
      mockPurchases.getCustomerInfo.mockResolvedValueOnce(customerInfo);

      await expect(checkSubscriptionStatus('premium')).resolves.toBe(true);
    });

    it('returns false when entitlement is not active', async () => {
      const customerInfo = {
        entitlements: { active: {} },
      } as unknown as CustomerInfo;
      mockPurchases.getCustomerInfo.mockResolvedValueOnce(customerInfo);

      await expect(checkSubscriptionStatus('missing')).resolves.toBe(false);
    });

    it('returns false when fetching customer info fails', async () => {
      mockPurchases.getCustomerInfo.mockRejectedValueOnce(new Error('fail'));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(checkSubscriptionStatus('premium')).resolves.toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to check subscription status:',
        expect.any(Error),
      );

      errorSpy.mockRestore();
    });
  });

  describe('identifyUser', () => {
    it('logs in user with RevenueCat', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await identifyUser('user-123');

      expect(mockPurchases.logIn).toHaveBeenCalledWith('user-123');
      expect(logSpy).toHaveBeenCalledWith(
        'User identified in RevenueCat:',
        'user-123',
      );

      logSpy.mockRestore();
    });

    it('rethrows errors from RevenueCat login', async () => {
      const error = new Error('login failed');
      mockPurchases.logIn.mockRejectedValueOnce(error);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(identifyUser('bad-user')).rejects.toThrow(error);
      expect(errorSpy).toHaveBeenCalledWith('Failed to identify user:', error);

      errorSpy.mockRestore();
    });
  });

  describe('logoutUser', () => {
    it('logs out user from RevenueCat', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await logoutUser();

      expect(mockPurchases.logOut).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('User logged out from RevenueCat');

      logSpy.mockRestore();
    });

    it('rethrows errors from RevenueCat logout', async () => {
      const error = new Error('logout failed');
      mockPurchases.logOut.mockRejectedValueOnce(error);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(logoutUser()).rejects.toThrow(error);
      expect(errorSpy).toHaveBeenCalledWith('Failed to logout user:', error);

      errorSpy.mockRestore();
    });
  });
});
