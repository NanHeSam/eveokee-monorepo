# RevenueCat Integration

This document describes the RevenueCat integration for in-app purchases and subscriptions in the Eveokee mobile app.

## Overview

RevenueCat is integrated to handle in-app purchases and subscription management across iOS and Android platforms. The SDK is initialized early in the app lifecycle and provides utilities for managing purchases, subscriptions, and customer information.

## Setup

### Environment Variables

Add the RevenueCat API keys to your `.env` file. You need separate keys for iOS and Android:

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=your_ios_api_key_here
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=your_android_api_key_here
```

For testing, you can use the same test API key for both platforms:
```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=test_LtxNCqRAMjnUpkXWhgPBPXGxsza
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=test_LtxNCqRAMjnUpkXWhgPBPXGxsza
```

**Important**: In production, you must use different API keys for iOS and Android. Get these from your RevenueCat dashboard under Project Settings → API Keys.

### Configuration

RevenueCat is automatically initialized when the app starts in `App.tsx`. The initialization:
- Checks for the API keys in environment variables
- Configures the SDK with platform-specific keys (iOS or Android)
- Enables debug logging for development
- Only runs on iOS and Android platforms (not web)

#### Android BILLING Permission

The app includes a custom Expo config plugin (`plugins/with-android-billing-permission.js`) that automatically adds the required `com.android.vending.BILLING` permission to the Android manifest. This permission is required for Google Play in-app purchases to work.

When you build the app with EAS or run `npx expo prebuild`, this permission will be automatically added to your AndroidManifest.xml.

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
const result = await purchasePackage(packageToPurchase);

switch (result.status) {
  case 'success':
    // Purchase successful
    console.log('Customer info:', result.customerInfo);
    break;
  case 'cancelled':
    // User cancelled the purchase
    console.log('Purchase was cancelled by user');
    break;
  case 'error':
    // Purchase failed with error
    console.error('Purchase failed:', result.code, result.message);
    break;
}
```

### Restore Purchases

```typescript
const result = await restorePurchases();

switch (result.status) {
  case 'success':
    // Restore successful
    console.log('Customer info:', result.customerInfo);
    break;
  case 'cancelled':
    // User cancelled the restore (uncommon)
    console.log('Restore was cancelled by user');
    break;
  case 'error':
    // Restore failed with error
    console.error('Restore failed:', result.code, result.message);
    break;
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
try {
  await identifyUser(userId);
  console.log('User successfully identified in RevenueCat');
} catch (error) {
  console.error('Failed to identify user in RevenueCat:', error);
  // Handle error (e.g., retry, show user message)
}
```

When a user signs out, log them out from RevenueCat:

```typescript
try {
  await logoutUser();
  console.log('User successfully logged out from RevenueCat');
} catch (error) {
  console.error('Failed to logout user from RevenueCat:', error);
  // Handle error (e.g., retry, show user message)
}
```

## Best Practices

1. **User Identification**: Always identify users with their unique user ID after authentication to sync purchases across devices.

2. **Error Handling**: 
   - Purchase functions (`purchasePackage`, `restorePurchases`) return discriminated result objects that distinguish between success, cancellation, and errors
   - User identity functions (`identifyUser`, `logoutUser`) throw errors that should be caught and handled by callers
   - Always wrap these functions in try-catch blocks for proper error handling and retry logic

3. **Restore Purchases**: Provide a "Restore Purchases" button in your settings for users who reinstall the app or switch devices.

4. **Entitlements**: Use entitlement identifiers (configured in RevenueCat dashboard) to check access rather than product IDs.

5. **Testing**: Use the test API key for development and testing. Configure products in the RevenueCat dashboard.

## RevenueCat Dashboard

Configure your products, entitlements, and offerings in the [RevenueCat dashboard](https://app.revenuecat.com):

1. Create products that match your App Store Connect / Google Play Console products
2. Define entitlements (e.g., "premium", "pro")
3. Create offerings with packages (e.g., monthly, annual)
4. Set up webhooks for server-side integration if needed

## Backend Integration

The backend automatically syncs subscription status from RevenueCat via webhooks:

### Webhook Setup

1. In your RevenueCat dashboard, go to Project Settings → Integrations → Webhooks
2. Add a new webhook with URL: `https://your-convex-backend.convex.site/webhooks/revenuecat`
3. The webhook will automatically sync subscription status to your Convex backend

### How It Works

- When a user makes a purchase, RevenueCat sends a webhook to your backend
- The backend updates the user's subscription status and tier
- Usage limits are automatically enforced based on the subscription tier
- The backend tracks music generation usage and resets counters based on the subscription period

### Subscription Tiers

The following product IDs map to subscription tiers:
- `eveokee_premium_monthly` → monthly tier (90 generations/month)
- `eveokee_premium_annual` → yearly tier (1000 generations/year)

Make sure these product IDs match what you configure in App Store Connect and Google Play Console.

## Mobile App Usage

Use the `useRevenueCat` hook to manage purchases in your app:

```typescript
import { useRevenueCat } from './app/hooks/useRevenueCat';

function SubscriptionScreen() {
  const {
    offerings,
    customerInfo,
    loading,
    purchasePackage,
    restorePurchases,
    hasActiveSubscription,
  } = useRevenueCat();

  if (loading) return <LoadingSpinner />;

  return (
    <View>
      {offerings?.availablePackages.map((pkg) => (
        <Button
          key={pkg.identifier}
          onPress={() => purchasePackage(pkg)}
          title={`Subscribe - ${pkg.product.priceString}`}
        />
      ))}
      <Button onPress={restorePurchases} title="Restore Purchases" />
    </View>
  );
}
```

## Theme Support

The paywall automatically adapts to the user's system theme (light/dark mode). This is configured through the RevenueCat dashboard and handled automatically by the `PaywallModal` component.

### Configuration

1. **RevenueCat Dashboard Setup**
   - Go to your RevenueCat dashboard → Tools → Paywalls
   - Configure separate themes for light and dark modes
   - Enable "Auto-detect system theme" option

2. **Color Configuration**
   - Use the app's color palette for consistent theming
   - Light mode: Use `backgroundLight`, `textPrimaryLight`, etc.
   - Dark mode: Use `backgroundDark`, `textPrimaryDark`, etc.

3. **Testing**
   - Test on both iOS and Android devices
   - Switch between light and dark modes in device settings
   - Verify paywall appearance matches the app's theme

For detailed setup instructions, see [REVENUECAT_THEME_SETUP.md](./REVENUECAT_THEME_SETUP.md).

## Resources

- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [React Native SDK Guide](https://docs.revenuecat.com/docs/reactnative)
- [Expo Integration](https://docs.revenuecat.com/docs/reactnative#expo)
- [Webhook Events](https://docs.revenuecat.com/docs/webhooks)
- [Paywall Theme Configuration](https://docs.revenuecat.com/docs/tools/paywalls/creating-paywalls/customer-states)
