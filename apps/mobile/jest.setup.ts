import 'react-native-gesture-handler/jestSetup';

// Expo installs a lazy native fetch getter that Jest can touch during teardown.
// Keep unit tests offline and avoid loading native modules after cleanup.
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: jest.fn(() => Promise.reject(new Error('Mock fetch explicitly in network tests.'))),
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-constants', () => ({
  manifest: { extra: {} },
  expoConfig: { extra: {} },
}));
