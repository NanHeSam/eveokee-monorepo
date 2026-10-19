# Screens and verification

Captured on iPhone 17 Pro / **iOS 26.5**, using Xcode 27.0 (27A266a), October 18, 2026. Native Simulator build is **ad-hoc signed**, with the real development configuration loaded from the ignored xcconfig.

## Screenshot provenance

- `sign-in.png`: actual signed-out app, dev Clerk initialized. Not a fixture screen. Its stars are decorative and do not represent authenticated data.
- `sign-in-email.png`: actual ClerkKitUI email/auth entry, before entering any credentials or requesting a code.
- `fixture-today.png`, `fixture-song.png`, `fixture-my-sky.png`: production SwiftUI views driven by explicitly synthetic, network-free fixtures. Permanent banner: **FIXTURE PREVIEW · SYNTHETIC DATA · NO AUDIO**.
- `fixture-anchor.png`, `fixture-compose.png`, `fixture-moments.png`: synthetic source sheet, text-entry fallback (save disabled), and accessible trace list. Sheets also identify fixture provenance.
- `fixture-today-accessibility.png`, `fixture-my-sky-accessibility.png`, `fixture-song-accessibility.png`: largest Dynamic Type launch preference plus Reduce Motion launch preference. These prove layout/test navigation, not a manual audit of the OS accessibility settings.

The signed-out captures use `xcrun simctl io DBE96545-8202-4F56-8892-11B7CFDBFB3E screenshot <path>`. Fixture captures are unmodified XCTest `XCUIScreen.main.screenshot()` attachments exported with `xcresulttool`; the debug launch route uses the actual app views. No user data was invented or represented as a successful authenticated fetch. No audio URLs exist in fixtures; the highlighted lyric is advanced by the real lyric-seek controls, without implying audio played.

Interactive Apple/email sign-in was **not completed**. There was no existing native persisted session and no unattended access to Sam's Apple/verification credentials. No verification email was requested. The main screens are therefore fixture previews, not screenshots of real dev account data.

## Commands executed

From repository root, common simulator build command:

```sh
xcodebuild -project apps/ios/Eveokee.xcodeproj -scheme Eveokee \
  -destination 'platform=iOS Simulator,id=DBE96545-8202-4F56-8892-11B7CFDBFB3E' \
  -derivedDataPath apps/ios/DerivedData CODE_SIGN_IDENTITY=- build
```

**PASS** after regeneration, and again after signing/configuration refinements. The first exploratory build failed at link because the project had been generated before all Swift sources were added; regeneration fixed it. A separate runtime inspection caught absent custom Info.plist keys and those were corrected before the actual dev sign-in launch. Both keys were then verified present without printing their values. `codesign` verification is performed on the final app.

Every test invocation used:

```sh
xcodebuild -project apps/ios/Eveokee.xcodeproj -scheme Eveokee \
  -destination 'platform=iOS Simulator,id=DBE96545-8202-4F56-8892-11B7CFDBFB3E' \
  -derivedDataPath apps/ios/DerivedData \
  -resultBundlePath /tmp/<result>.xcresult CODE_SIGN_IDENTITY=- test
```

| `<result>` | Outcome / reason for the next run |
| --- | --- |
| `eveokee-tests-1` | PASS, 6 unit + 2 UI; initial navigation/anchor snapshots |
| `eveokee-tests-final` | PASS, 6 unit + 2 UI; config keys, clearer labels, lighter cluster rendering, lyric seek |
| `eveokee-tests-verified` | PASS, 6 unit + 2 UI; composer/list captures, decorative sign-in stars, buffering state |
| `eveokee-tests-signed` | PASS, 6 unit + 2 UI; Sign in with Apple entitlement, contrast lines and retry control |
| `eveokee-tests-accessible` | PASS, 6 unit + 2 UI; compact accessible icon tabs, fixture banners inside sheets, large-type song capture |

Source tests: `apps/ios/__tests__/ConstellationTests.swift` and `apps/ios/EveokeeUITests/FixtureSnapshotTests.swift`. Unit coverage: opaque IDs/floating timestamps, missing fields and query projections, local-day DST boundaries, music joins/deduplication/shared-song exclusion, timed-word boundaries and malformed ranges, evenly spaced lyric fallback/empty lyrics. UI coverage: Today, composer, trace list, Song, two lyric skips, actual diary anchor, My sky, and large-type navigation. **All tests use fixtures, with no network dependencies.**

Other checks: `xcodegen generate --spec apps/ios/project.yml`, SPM resolve, `git diff --check`, ignored-secret checks, and `pnpm list -r --depth -1` (only root/mobile/web/backend; ios absent). JS package tests were not run because no JS package code changed.

## Verified and still requiring interaction

**Verified:** official SDK symbols compile against pinned released packages under Swift 6 complete strict concurrency; signed Simulator install/launch; real dev Clerk initialization and sign-in/email entry rendering; all eight automated tests; fixture screen interactions and layouts. Real secrets remain ignored. Backend/mobile/web are untouched.

**Unverified at runtime:** Apple credential completion; email verification completion; session persistence after an actual login; Convex JWT audience acceptance and refresh; actual dev diary/media/event subscriptions; a real createDiary round trip; real AVPlayer streaming, background audio, interruption recovery and lock-screen controls; physical-device signing/entitlement provisioning; VoiceOver and the actual Settings Reduce Motion/Increase Contrast toggles. API availability and source review do not claim those round trips passed.

**Stubbed/deferred:** hold-to-speak/transcription (no microphone is used), exact lyric-to-event/media provenance, song generation/progress UI, photo/place ingestion, dedicated iPad/Mac layouts and visionOS immersive rendering. Native text entry and playback are implemented, but require dev authentication for integration verification.

Next verification: Sam signs in on the dev native app, adds a short text moment, opens an existing day/track, then locks/backgrounds the device to test audio. Next implementation phase is voice capture plus explicit source anchors with the backend lane. No Convex deployment, production mutation, native distribution archive, or merge was performed.
