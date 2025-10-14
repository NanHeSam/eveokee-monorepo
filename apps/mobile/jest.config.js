module.exports = {
  preset: 'jest-expo/universal',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/**/__tests__/**/*.test.[jt]s?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:react-native|@react-native|expo(nent)?|@expo|@unimodules|unimodules|@clerk|nativewind|react-native-track-player)/)'
  ],
};
