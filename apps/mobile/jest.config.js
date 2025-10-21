const esModules = [
  '.pnpm',
  '(jest-)?react-native',
  '@react-native',
  '@react-native-community',
  'expo',
  '@expo',
  'expo-modules-core',
  '@expo-google-fonts',
  '@unimodules',
  'react-navigation',
  '@react-navigation',
  '@sentry/react-native',
  'native-base',
  '@clerk',
  'nativewind',
];

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/**/__tests__/**/*.test.[jt]s?(x)'],
  transformIgnorePatterns: [
    `/node_modules/(?!(${esModules.join('|')})/)`,
    '/node_modules/react-native-reanimated/plugin/',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    '**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
};
