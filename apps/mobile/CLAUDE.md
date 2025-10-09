# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Music Diary is a React Native application built with Expo that allows users to create diary entries with associated AI-generated music. The app uses:
- **Frontend**: React Native with Expo (uses dev builds, **New Architecture enabled**)
- **Backend**: Convex for real-time database and backend functions
- **Authentication**: Clerk for user authentication
- **State Management**: React Native AsyncStorage and Expo SecureStore

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
```bash
npm start              # Start Expo dev server
npm run android        # Start on Android device/emulator (uses dev build)
npm run ios           # Start on iOS device/simulator (uses dev build)
npm run web           # Start web version
```

**Note**: This project uses **Expo dev builds** (not Expo Go) due to native modules like React Native Track Player. After making native changes, run:
```bash
npx expo prebuild --clean     # Regenerate native projects
npx expo run:ios             # Rebuild for iOS
npx expo run:android         # Rebuild for Android
```

### Convex Backend
```bash
npx convex dev        # Run Convex backend in development mode
```

## Architecture

### Project Structure
- `App.tsx` - Root application component
- `index.ts` - Entry point that registers the root component
- `src/` - Main source directory with subdirectories:
  - `components/` - Reusable UI components
  - `screens/` - Screen-level components
  - `hooks/` - Custom React hooks
  - `types/` - TypeScript type definitions
  - `utils/` - Utility functions
- `convex/` - Convex backend code
  - `schema.ts` - Database schema definitions
  - `_generated/` - Auto-generated Convex files (do not edit)

### Database Schema (Convex)

The app uses a Convex backend with the following tables:

1. **userAuth**: Stores Clerk authentication data
   - Primary key: `id` (Clerk ID)
   - Indexed by `id`

2. **users**: User profile data (separate from auth)
   - Primary key: `id` (same Clerk ID as userAuth)
   - Links to userAuth via `id`
   - Contains name, subscription tier, timestamps

3. **diaries**: User diary entries
   - Primary key: `id` (UUID string)
   - Each entry has a date, content, optional title
   - Links to primary music track via `primaryMusicId`
   - Indexed by user, creation date, and diary date

4. **music**: AI-generated music tracks
   - Primary key: `id` (UUID string)
   - Links to diary entries via `diaryId`
   - Contains audio/image URLs, lyrics (plain and timestamped)
   - Supports async generation with `taskId` and `musicIndex`
   - Status field tracks generation state: "pending", "ready", "failed"
   - Stores Suno API metadata in `metadata` field
   - Soft delete support via `deletedAt`

### Key Relationships
- User authentication (Clerk) → userAuth → users (via `id`)
- Users → diaries (one-to-many via `userId`)
- diaries → music (one-to-many via `diaryId`)
- diaries can have a primary music track (`primaryMusicId`)
- Music tracks can be grouped by generation tasks (`taskId`)

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
