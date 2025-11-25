import { ExpoConfig, ConfigContext } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return "com.eveokee.app.dev";
  }

  if (IS_PREVIEW) {
    return "com.eveokee.app.preview";
  }

  return "com.eveokee.app";
};

const getAppName = () => {
  if (IS_DEV) {
    return "eveokee (Dev)";
  }

  if (IS_PREVIEW) {
    return "eveokee (Preview)";
  }

  return "eveokee";
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: "eveokee-mobile",
  version: "1.3.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  plugins: [
    "expo-apple-authentication",
    "./plugins/with-folly-no-coroutines",
    "./plugins/with-revenuecat",
    "expo-dev-client",
    "expo-system-ui",
    "expo-web-browser",
    "expo-image-picker",
    "./plugins/with-react-bridging-header",
    "./plugins/with-expo-image-picker-autolinking",
    [
      "expo-notifications",
      {
        icon: "./assets/icon.png",
        color: "#A8E6CF",
        sounds: []
      }
    ],
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        project: "eveokee-mobile",
        organization: "eveokee"
      }
    ]
  ],
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "cover",
    backgroundColor: "#F5F0E8"
  },
  ios: {
    ...config.ios,
    supportsTablet: false,
    bundleIdentifier: getUniqueIdentifier(),
    infoPlist: {
      UIBackgroundModes: [
        "audio"
      ],
      ITSAppUsesNonExemptEncryption: false,
      NSPhotoLibraryUsageDescription: "We need access to your photo library to upload photos and videos to your diary entries.",
      NSPhotoLibraryAddUsageDescription: "We need access to save photos and videos to your diary entries."
    },
    appleTeamId: "5KQ8K9W7XS"
  },
  android: {
    ...config.android,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#A8E6CF"
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: getUniqueIdentifier(),
    permissions: [
      "RECEIVE_BOOT_COMPLETED"
    ]
  },
  scheme: "eveokee",
  web: {
    bundler: "metro",
    favicon: "./assets/favicon.png"
  },
  extra: {
    eas: {
      projectId: "bfdda9bf-addd-4b16-9602-89df7a96933b"
    }
  },
  owner: "eveokee"
});
