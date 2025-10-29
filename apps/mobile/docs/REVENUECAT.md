# RevenueCat Integration

This document describes the RevenueCat integration for in-app purchases and subscriptions in the Eveokee mobile app.

## Overview

RevenueCat is integrated as the **single source of truth** for subscription status on mobile devices. The SDK is initialized early in the app lifecycle and provides utilities for managing purchases, subscriptions, and customer information. The backend maintains a snapshot of subscription status for server-side gating and includes an audit log for all subscription events.

### Architecture

- **Mobile**: RevenueCat SDK provides real-time subscription status via `Purchases.getCustomerInfo()`
- **Backend**: Convex `subscriptionStatuses` table serves as a server-side "hint" snapshot
- **Audit Log**: `subscriptionLog` table tracks all subscription events for debugging and reconciliation
- **Reconciliation**: Mobile usage checks trigger backend reconciliation when statuses differ

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

1. **RevenueCat as Source of Truth**: Always use `Purchases.getCustomerInfo()` for UI gating decisions on mobile.

2. **Reconciliation for Accuracy**: Use `checkUsageWithReconciliation` for critical operations like music generation to ensure backend and mobile status are in sync.

3. **User Identification**: Always identify users with their unique user ID after authentication to sync purchases across devices.

4. **Error Handling**: 
   - Purchase functions (`purchasePackage`, `restorePurchases`) return discriminated result objects that distinguish between success, cancellation, and errors
   - User identity functions (`identifyUser`, `logoutUser`) throw errors that should be caught and handled by callers
   - Always wrap these functions in try-catch blocks for proper error handling and retry logic

5. **Restore Purchases**: Provide a "Restore Purchases" button in your settings for users who reinstall the app or switch devices.

6. **Entitlements**: Use entitlement identifiers (configured in RevenueCat dashboard) to check access rather than product IDs.

7. **Testing**: Use the test API key for development and testing. Configure products in the RevenueCat dashboard.

8. **Grace Period Handling**: The system automatically handles grace periods during billing issues - users retain access until the grace period expires.

9. **Audit Trail**: All subscription events are logged in the `subscriptionLog` table for debugging and compliance purposes.

## RevenueCat Dashboard

Configure your products, entitlements, and offerings in the [RevenueCat dashboard](https://app.revenuecat.com):

1. Create products that match your App Store Connect / Google Play Console products
2. Define entitlements (e.g., "premium", "pro")
3. Create offerings with packages (e.g., monthly, annual)
4. Set up webhooks for server-side integration if needed

## Backend Integration

The backend maintains subscription status through webhooks and reconciliation:

### Webhook Setup

1. In your RevenueCat dashboard, go to Project Settings → Integrations → Webhooks
2. Add a new webhook with URL: `https://your-convex-backend.convex.site/webhooks/revenuecat`
3. The webhook will automatically sync subscription status to your Convex backend

### How It Works

#### Webhook Processing
- When a user makes a purchase, RevenueCat sends a webhook to your backend
- The backend updates the `subscriptionStatuses` snapshot with the latest status
- Only state changes are logged to the `subscriptionLog` audit trail
- Supports all RevenueCat event types: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE, etc.

#### Reconciliation Flow
- Mobile app calls `checkUsageWithReconciliation` before music generation
- Backend compares RevenueCat customer info with `subscriptionStatuses` snapshot
- If different, backend updates snapshot and logs reconciliation event
- Daily cron job reconciles stale records (>24 hours old)

#### Server-Side Gating
- Premium features check `subscriptionStatuses` table for access control
- Supports "active", "in_grace", "canceled", and "expired" statuses
- Grace period users retain access during billing issues
- Custom music limits can override tier defaults

### Subscription Tiers

The following product IDs map to subscription tiers:
- `eveokee_premium_monthly` → monthly tier (90 generations/month)
- `eveokee_premium_annual` → yearly tier (1000 generations/year)

Make sure these product IDs match what you configure in App Store Connect and Google Play Console.

### Environment Variables

Backend requires these environment variables:
```bash
REVENUECAT_API_KEY=your_revenuecat_api_key_here
```

This API key is used for:
- Daily reconciliation cron job
- Fetching customer info from RevenueCat REST API
- Verifying subscription status for stale records

## Mobile App Usage

### Purchase Management

Use the `useRevenueCat` hook to manage purchases in your app:

```typescript
import { useRevenueCat } from './app/hooks/useRevenueCat';

function SubscriptionScreen() {
  const {
    offerings,
    customerInfo,
    // Individual loading states for granular control
    loadingOfferings,
    loadingPurchase,
    loadingRestore,
    loadingCustomerInfo,
    // Computed loading state for backward compatibility
    loading,
    purchasePackage,
    restorePurchases,
    hasActiveSubscription,
  } = useRevenueCat();

  // Use specific loading states for better UX
  if (loadingOfferings) return <LoadingSpinner text="Loading offerings..." />;
  if (loadingPurchase) return <LoadingSpinner text="Processing purchase..." />;
  if (loadingRestore) return <LoadingSpinner text="Restoring purchases..." />;
  
  // Or use the computed loading state for simple cases
  if (loading) return <LoadingSpinner />;

  return (
    <View>
      {offerings?.availablePackages.map((pkg) => (
        <Button
          key={pkg.identifier}
          onPress={() => purchasePackage(pkg)}
          disabled={loadingPurchase}
          title={loadingPurchase ? 'Processing...' : `Subscribe - ${pkg.product.priceString}`}
        />
      ))}
      <Button 
        onPress={restorePurchases} 
        disabled={loadingRestore}
        title={loadingRestore ? 'Restoring...' : 'Restore Purchases'} 
      />
    </View>
  );
}
```

### Usage Checking with Reconciliation

For accurate subscription status, use the `useMusicGeneration` hook which includes reconciliation:

```typescript
import { useMusicGeneration } from './app/hooks/useMusicGeneration';

function MusicGenerationScreen() {
  const { generateMusic, checkCanGenerateWithReconciliation, isGenerating } = useMusicGeneration({
    onGenerationStart: () => console.log('Starting music generation...'),
    onGenerationComplete: (result) => console.log('Generation completed:', result),
    onGenerationError: (error) => console.error('Generation failed:', error),
  });

  const handleGenerateMusic = async () => {
    // This automatically reconciles with RevenueCat before checking limits
    const result = await generateMusic();
    if (result?.success) {
      // Music generation started successfully
    }
  };

  return (
    <TouchableOpacity 
      onPress={handleGenerateMusic}
      disabled={isGenerating}
    >
      <Text>{isGenerating ? 'Generating...' : 'Generate Music'}</Text>
    </TouchableOpacity>
  );
}
```

### Manual Reconciliation

For components that need real-time accuracy, use the reconciliation endpoint directly:

```typescript
import { useUsage } from './app/store/useSubscriptionStore';
import { getCustomerInfo } from './app/utils/revenueCat';

function UsageComponent() {
  const { checkUsageWithReconciliation } = useUsage();

  const handleRefreshUsage = async () => {
    try {
      const rcCustomerInfo = await getCustomerInfo();
      const result = await checkUsageWithReconciliation({ 
        rcCustomerInfo: rcCustomerInfo || undefined 
      });
      
      if (result.reconciled) {
        console.log('Usage reconciled with RevenueCat');
      }
      
      // Update UI with result.canGenerate, result.currentUsage, etc.
    } catch (error) {
      console.error('Failed to reconcile usage:', error);
    }
  };

  return (
    <TouchableOpacity onPress={handleRefreshUsage}>
      <Text>Refresh Usage</Text>
    </TouchableOpacity>
  );
}
```

### Loading States

The `useRevenueCat` hook provides granular loading states for better user experience:

- `loadingOfferings` - When loading available subscription packages
- `loadingPurchase` - When processing a purchase
- `loadingRestore` - When restoring previous purchases
- `loadingCustomerInfo` - When loading customer subscription status
- `loading` - Computed state that's true if any operation is loading (for backward compatibility)

This allows you to:
- Show specific loading messages for each operation
- Disable only the relevant buttons during operations
- Allow concurrent operations without UI conflicts
- Provide better user feedback

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

## Troubleshooting

### Common Issues

1. **Subscription Status Mismatch**
   - **Symptom**: Mobile shows active subscription but backend denies access
   - **Solution**: Use `checkUsageWithReconciliation` to sync status
   - **Prevention**: Always use reconciliation for critical operations

2. **Webhook Not Received**
   - **Symptom**: Purchase successful but backend not updated
   - **Solution**: Check webhook URL in RevenueCat dashboard
   - **Fallback**: Daily cron job will reconcile stale records

3. **Grace Period Confusion**
   - **Symptom**: User has access but subscription appears expired
   - **Solution**: Check `subscriptionStatuses.status` for "in_grace"
   - **Note**: Grace period users retain access during billing issues

4. **Reconciliation Failures**
   - **Symptom**: `checkUsageWithReconciliation` returns error
   - **Solution**: Check `REVENUECAT_API_KEY` environment variable
   - **Fallback**: App falls back to cached usage data

### Debugging

1. **Check Audit Log**: Query `subscriptionLog` table to see all subscription events
2. **Verify Webhooks**: Check RevenueCat dashboard webhook delivery logs
3. **Test Reconciliation**: Use manual reconciliation in settings to verify API connectivity
4. **Monitor Cron Jobs**: Check Convex logs for daily reconciliation results

### Testing

1. **Webhook Testing**: Use RevenueCat's webhook simulator to test event processing
2. **Reconciliation Testing**: Create test purchases and verify reconciliation works
3. **Grace Period Testing**: Simulate billing issues to test grace period handling
4. **Edge Cases**: Test subscription transfers, refunds, and cancellations

## Resources

- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [React Native SDK Guide](https://docs.revenuecat.com/docs/reactnative)
- [Expo Integration](https://docs.revenuecat.com/docs/reactnative#expo)
- [Webhook Events](https://docs.revenuecat.com/docs/webhooks)
- [Paywall Theme Configuration](https://docs.revenuecat.com/docs/tools/paywalls/creating-paywalls/customer-states)
- [RevenueCat REST API](https://docs.revenuecat.com/reference#subscribers)

## Migration Notes

### From Previous Implementation

If migrating from the previous RevenueCat implementation:

1. **No Breaking Changes**: Existing code continues to work
2. **New Features**: Use `checkUsageWithReconciliation` for improved accuracy
3. **Audit Logging**: All subscription events are now tracked automatically
4. **Grace Periods**: Billing issues are handled automatically with grace periods
5. **Daily Reconciliation**: Stale records are reconciled automatically

### Environment Variables

Add the backend API key to your Convex environment:
```bash
REVENUECAT_API_KEY=your_revenuecat_api_key_here
```

This enables:
- Daily reconciliation cron job
- Manual reconciliation via API
- Stale record detection and updates
