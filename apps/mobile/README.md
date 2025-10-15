## Music Diary

### Running a development build

This project uses a custom development client in order to support native modules such as `react-native-track-player`.

1. Install dependencies
   ```bash
   pnpm install
   ```

2. Build and install a development client (required once per platform or after native changes)
   ```bash
   npx expo run:ios --device
   # or
   npx expo run:android
   ```

3. Start the Metro bundler
   ```bash
   pnpm run start
   ```

4. Open the app through the development client on your device or simulator.

### Audio playback

The app uses `react-native-track-player` for streaming music. Playback controls are available through a mini-player UI that appears at the bottom once a track starts.


