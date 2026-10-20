# Eveokee — Constellation for Apple

Native SwiftUI, Swift 6 strict concurrency, iOS/iPadOS 26+. This is independent of Expo, with the existing development Convex deployment. Start with [DESIGN](../../docs/native-apple/DESIGN.md) and [ARCHITECTURE](../../docs/native-apple/ARCHITECTURE.md).

## Setup and regenerate

Requires Xcode 26+ with an iOS 26 runtime (verified with Xcode 27, iOS 26.5), and XcodeGen (`brew install xcodegen`). From the repository root:

```sh
cp apps/ios/Config/Secrets.example.xcconfig apps/ios/Config/Secrets.xcconfig
# Fill pk_test Clerk key and DEV Convex URL. Keep https:/$()/ in xcconfig URLs.
xcodegen generate --spec apps/ios/project.yml
open apps/ios/Eveokee.xcodeproj
```

`project.yml`, the generated project, Info.plist template and Package.resolved are committed. Regenerate after adding/removing source files or changing target/package settings. Secrets.xcconfig and DerivedData/xcuserdata are ignored. Xcode resolves the pinned official ConvexMobile and ClerkKit/ClerkKitUI packages via SPM. Do not put values into the project or commit a built app. No package.json: pnpm/Turbo exclude this native app automatically.

Choose an iOS 26+ simulator. **Keep code signing enabled** for Clerk Keychain (ad hoc identity `-` works on Simulator). The app ships as `com.eveokee.app` (team `5KQ8K9W7XS`), replacing the React Native app in TestFlight. It accepts development (`pk_test_`) or production (`pk_live_`) Clerk keys; release builds pass the production Clerk key and Convex URL as `xcodebuild` build settings, so `Secrets.xcconfig` can stay on development values.

## Build and test

```sh
# Replace the simulator name/ID with an installed iOS 26+ device.
xcodebuild -project apps/ios/Eveokee.xcodeproj -scheme Eveokee \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -derivedDataPath apps/ios/DerivedData CODE_SIGN_IDENTITY=- build

xcodebuild -project apps/ios/Eveokee.xcodeproj -scheme Eveokee \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -derivedDataPath apps/ios/DerivedData \
  -resultBundlePath /tmp/eveokee-tests.xcresult CODE_SIGN_IDENTITY=- test
```

Each test run needs a fresh result bundle path. Unit tests live in `__tests__`; UI tests navigate the real SwiftUI views with a synthetic, network-free store. They attach Today, Song, source anchor, My sky and accessibility-size screenshots. Export with:

```sh
xcrun xcresulttool export attachments --path /tmp/eveokee-tests.xcresult \
  --output-path /tmp/eveokee-test-images
```

## Preview without authenticating

In a Debug scheme only, add `--fixture-preview` to launch arguments. A persistent banner says `FIXTURE PREVIEW · SYNTHETIC DATA · NO AUDIO`. This bypasses Clerk and Convex, disables saving and supplies synthetic diaries/events/songs through the same production views. There are no fixture audio URLs or external network requests. Optionally set `EVEO_PREVIEW_SCREEN` to `Today`, `The song`, or `My sky` in the launch environment. Release builds ignore the fixture launch route. Do not present fixture screenshots as real account data.

The signed-out native screen uses the real dev Clerk configuration. Continue with Apple invokes Clerk's native flow; Continue with email opens ClerkKitUI for sign-in/up and verification. Auth tokens request the existing `convex` template because the backend expects that audience. After successful sign-in the app uses real data only; a missing current day shows the empty Today state.

Voice capture/transcription is explicitly coming soon. Existing songs play; creating/generating a new song is a later phase. Text entry uses the existing createDiary mutation. No backend deploy, Expo/web change, monetization, or production access is needed for this branch.

See [screens and verification](../../docs/native-apple/screens/README.md) for what was actually exercised versus what still requires Sam's interactive sign-in.
