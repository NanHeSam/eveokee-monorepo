const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

/**
 * Config plugin for RevenueCat (react-native-purchases)
 * This plugin configures the necessary permissions and settings for RevenueCat
 */
const withRevenueCat = (config) => {
  // Configure Android
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest;

    // Add BILLING permission for Google Play
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

  // Configure iOS
  config = withInfoPlist(config, (config) => {
    // Add any iOS-specific configurations if needed
    // RevenueCat typically doesn't require additional Info.plist entries
    return config;
  });

  return config;
};

module.exports = withRevenueCat;
