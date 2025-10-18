# RevenueCat Integration

This document describes the RevenueCat integration for in-app purchases and subscriptions in the Eveokee mobile app.

## Overview

RevenueCat is integrated to handle in-app purchases and subscription management across iOS and Android platforms. The SDK is initialized early in the app lifecycle and provides utilities for managing purchases, subscriptions, and customer information.

## Setup

### Environment Variables

Add the RevenueCat API key to your `.env` file:

```bash
EXPO_PUBLIC_REVENUECAT_API_KEY=your_api_key_here
```

For testing, use the test API key:
```bash
EXPO_PUBLIC_REVENUECAT_API_KEY=test_LtxNCqRAMjnUpkXWhgPBPXGxsza
```

### Configuration

RevenueCat is automatically initialized when the app starts in `App.tsx`. The initialization:
- Checks for the API key in environment variables
- Configures the SDK with debug logging enabled
- Only runs on iOS and Android platforms (not web)

## Usage

### Import the utilities

```typescript
import {
  getCustomerInfo,
  getOfferings,
  purchasePackage,
  restorePurchases,
  checkSubscriptionStatus,
  identifyUser,
  logoutUser,
} from './app/utils/revenueCat';
```

### Get Customer Information

```typescript
const customerInfo = await getCustomerInfo();
if (customerInfo) {
  console.log('Active subscriptions:', customerInfo.activeSubscriptions);
}
```

### Fetch Available Offerings

```typescript
const offering = await getOfferings();
if (offering) {
  const packages = offering.availablePackages;
  // Display packages to user
}
```

### Purchase a Package

```typescript
const packageToPurchase = offering.availablePackages[0];
const customerInfo = await purchasePackage(packageToPurchase);
if (customerInfo) {
  // Purchase successful
}
```

### Restore Purchases

```typescript
const customerInfo = await restorePurchases();
if (customerInfo) {
  // Purchases restored
}
```

### Check Subscription Status

```typescript
const hasAccess = await checkSubscriptionStatus('premium');
if (hasAccess) {
  // User has premium access
}
```

### User Identity Management

When a user signs in, identify them with RevenueCat:

```typescript
await identifyUser(userId);
```

When a user signs out, log them out from RevenueCat:

```typescript
await logoutUser();
```

## Best Practices

1. **User Identification**: Always identify users with their unique user ID after authentication to sync purchases across devices.

2. **Error Handling**: All utility functions handle errors gracefully and return null on failure. Always check return values.

3. **Restore Purchases**: Provide a "Restore Purchases" button in your settings for users who reinstall the app or switch devices.

4. **Entitlements**: Use entitlement identifiers (configured in RevenueCat dashboard) to check access rather than product IDs.

5. **Testing**: Use the test API key for development and testing. Configure products in the RevenueCat dashboard.

## RevenueCat Dashboard

Configure your products, entitlements, and offerings in the [RevenueCat dashboard](https://app.revenuecat.com):

1. Create products that match your App Store Connect / Google Play Console products
2. Define entitlements (e.g., "premium", "pro")
3. Create offerings with packages (e.g., monthly, annual)
4. Set up webhooks for server-side integration if needed

## Resources

- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [React Native SDK Guide](https://docs.revenuecat.com/docs/reactnative)
- [Expo Integration](https://docs.revenuecat.com/docs/reactnative#expo)
