# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **mobile app** in the Eveokee monorepo. It's a React Native application built with Expo that allows users to create diary entries with associated AI-generated music.

- **Frontend**: React Native with Expo (uses dev builds, **New Architecture enabled**)
- **Backend**: Shared Convex backend from `packages/backend/convex/`
- **Authentication**: Clerk for user authentication
- **State Management**: React Native AsyncStorage and Expo SecureStore

**Note**: This app is part of a monorepo. See the root [CLAUDE.md](../../CLAUDE.md) for full monorepo documentation.

## Tech Stack

- **Framework**: Expo SDK ~54.0 with React Native 0.81.4
- **Language**: TypeScript (strict mode enabled)
- **Backend**: Convex
- **Authentication**: Clerk Expo SDK
- **UI**: React Native with SafeAreaContext
- **Styling**: NativeWind v4.2.1 (TailwindCSS for React Native)
- **Audio Playback**: React Native Track Player v5.0.0-alpha0 (New Architecture compatible)
- **Animation**: React Native Reanimated v4.1.2
- **Worklets**: React Native Worklets (required by Reanimated v4)
- **State Management**: Zustand
- **Platforms**: iOS, Android, Web

## Commands

### Development

**From monorepo root:**
```bash
pnpm dev:mobile       # Start mobile app with Expo
pnpm run:ios          # Run on iOS simulator/device
pnpm run:android      # Run on Android emulator/device
```

**From mobile app directory:**
```bash
npm start              # Start Expo dev server
npm run android        # Start on Android device/emulator (uses dev build)
npm run ios           # Start on iOS device/simulator (uses dev build)
```

**Note**: This project uses **Expo dev builds** (not Expo Go) due to native modules like React Native Track Player. After making native changes, run:
```bash
npx expo prebuild --clean     # Regenerate native projects
npx expo run:ios             # Rebuild for iOS
npx expo run:android         # Rebuild for Android
```

### Convex Backend

The backend is shared across mobile and web apps. See root [CLAUDE.md](../../CLAUDE.md) for backend details.

**Deploy backend from root:**
```bash
cd packages/backend && npx convex deploy
```

## Architecture

### Project Structure
- `App.tsx` - Root application component
- `index.ts` - Entry point that registers the root component
- `trackPlayerService.ts` - React Native Track Player service for audio playback
- `app/` - Main application directory:
  - `components/` - Reusable UI components
  - `screens/` - Screen-level components
  - `hooks/` - Custom React hooks
  - `navigation/` - React Navigation configuration and types
  - `store/` - Zustand state management stores
  - `theme/` - Theme and styling utilities
  - `providers/` - React context providers

### Backend Integration

**Import the shared backend:**
```typescript
import { api } from '@backend/convex';
import { Id } from '@backend/convex/convex/_generated/dataModel';
```

**Important**: Always use `@backend/convex` as the import path - this is the workspace package name.

The Convex backend is shared between mobile and web apps. See root [CLAUDE.md](../../CLAUDE.md#convex-backend) for full database schema and backend documentation.

### Configuration Notes

#### General Settings
- TypeScript strict mode is active
- Edge-to-edge enabled on Android
- Environment variables in `.env.local` (not tracked in git)
- Native iOS/Android folders are gitignored (managed by Expo)

#### React Native New Architecture
**New Architecture is ENABLED** (`newArchEnabled: true` in app.json). Key configuration decisions:

1. **React 19**: Using React 19.1.0 which is required for New Architecture compatibility.

2. **Reanimated v4**: Upgraded to v4.1.2 for full New Architecture support. Keep its Babel plugin last in config.

3. **React Native Worklets**: Required peer dependency for Reanimated v4. Provides worklet support for animations.

4. **Track Player v5 Alpha**: Using v5.0.0-alpha0 which supports New Architecture (v4 does not).

5. **NativeWind v4**: Fully compatible with New Architecture and uses react-native-worklets internally.

6. **Folly coroutines disabled**: `FOLLY_HAS_COROUTINES=0` still set via `plugins/with-folly-no-coroutines.js` to prevent compile conflicts with Reanimated.

7. **Babel configuration**: Single `babel.config.js` only (no `.babelrc` or `package.json` overrides):
   - Presets: `babel-preset-expo` with `jsxImportSource: 'nativewind'` + `nativewind/babel`
   - Plugins: `react-native-reanimated/plugin` only (must be last)

8. **Metro configuration**: Uses `withNativeWind` wrapper for NativeWind v4 CSS processing.

#### Important Version Constraints
- **React**: Must use React 19.x for New Architecture
- **Reanimated**: Must use v4.x for New Architecture (v3 does not support it)
- **Track Player**: Must use v5.x alpha for New Architecture (v4 does not support it)
- **NativeWind**: v4.x required for worklets support
- **Worklets**: react-native-worklets required as peer dependency of Reanimated v4

#### Troubleshooting Build Issues
When encountering build errors, reset caches/builds:
```bash
# Clear caches
npx expo start -c                    # Clear Metro cache
rm -rf node_modules package-lock.json && npm install --legacy-peer-deps
rm -rf ~/Library/Developer/Xcode/DerivedData  # iOS only
rm -rf ~/Library/Caches/com.apple.dt.Xcode   # iOS only

# Regenerate native projects
npx expo prebuild --clean
```

**Note**: Always use `--legacy-peer-deps` when installing packages due to React 19 peer dependency conflicts with some packages that still expect React 18.
