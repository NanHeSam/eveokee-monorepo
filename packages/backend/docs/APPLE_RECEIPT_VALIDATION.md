# Apple Receipt Validation - RevenueCat Handling

## Summary

**Your codebase does NOT directly validate Apple App Store receipts.** Instead, you use **RevenueCat** as an intermediary service that handles receipt validation on your behalf.

## Apple's Requirement

Apple requires that when validating receipts on your server, your server must:
1. Always validate receipts against the **production App Store first**
2. If validation fails with error code `21007` ("Sandbox receipt used in production"), then validate against the **test/sandbox environment**

This scenario can occur when:
- A production-signed app receives receipts from Apple's test environment (common during App Review)
- Test accounts are used with production builds

## How Your Code Handles This

### Current Architecture

Your application uses **RevenueCat** for receipt validation:

1. **Mobile App**: Uses RevenueCat SDK to handle purchases
2. **RevenueCat Service**: Validates receipts with Apple's servers (handles production/sandbox logic internally)
3. **Your Backend**: Receives webhook events from RevenueCat after validation is complete

### What You Need to Verify

Since RevenueCat handles receipt validation, you should verify that RevenueCat implements Apple's recommended approach:

1. **RevenueCat Configuration**: Check your RevenueCat dashboard settings to ensure proper receipt validation is enabled
2. **RevenueCat Documentation**: Confirm that RevenueCat handles the production → sandbox fallback automatically
3. **Monitoring**: Watch your logs for `environment: "SANDBOX"` in webhook events to track when sandbox receipts are processed

### Code Changes Made

We've updated the code to:
- Track the `environment` field (`SANDBOX` or `PRODUCTION`) from RevenueCat webhooks
- Log the environment in webhook events for monitoring

This allows you to:
- Monitor when sandbox receipts are being processed
- Verify that RevenueCat is correctly handling mixed environments
- Debug issues if production apps receive sandbox receipts

### Files Modified

- `packages/backend/convex/models/webhooks/revenuecat.ts`: Added `environment` field to type definition
- `packages/backend/convex/webhooks/handlers/revenuecat.ts`: Added logging for `environment` field

## Next Steps

1. **Verify RevenueCat Configuration**:
   - Check RevenueCat dashboard → Project Settings
   - Confirm receipt validation is properly configured
   - Review RevenueCat's documentation on handling sandbox receipts

2. **Monitor Logs**:
   - Watch for webhook events with `environment: "SANDBOX"` 
   - This indicates RevenueCat processed a sandbox receipt
   - If you see these in production, it confirms RevenueCat is handling the scenario

3. **Contact RevenueCat Support** (if needed):
   - If you're unsure whether RevenueCat handles the production → sandbox fallback
   - Ask them to confirm they implement Apple's recommended validation flow

4. **Test Scenario** (optional):
   - Use a test account with a production build
   - Verify webhook events show `environment: "SANDBOX"`
   - Confirm subscriptions are correctly processed

## Important Note

If you were validating receipts **directly** with Apple's servers (not using RevenueCat), you would need to implement the production → sandbox fallback logic yourself. Since you're using RevenueCat, they should handle this automatically, but you should verify this with RevenueCat's documentation or support.

## References

- [Apple Receipt Validation](https://developer.apple.com/documentation/appstorereceipts/validating_receipts_with_the_app_store)
- [RevenueCat Documentation](https://docs.revenuecat.com/)

