const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Adds the BILLING permission to the Android manifest.
 * This is required for RevenueCat and Google Play in-app purchases.
 */
const withAndroidBillingPermission = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest;

    if (!mainApplication['uses-permission']) {
      mainApplication['uses-permission'] = [];
    }

    const billingPermission = 'com.android.vending.BILLING';
    const hasPermission = mainApplication['uses-permission'].some(
      (permission) => permission.$['android:name'] === billingPermission
    );

    if (!hasPermission) {
      mainApplication['uses-permission'].push({
        $: {
          'android:name': billingPermission,
        },
      });
    }

    return config;
  });
};

module.exports = withAndroidBillingPermission;
