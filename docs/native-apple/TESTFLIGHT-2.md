# TestFlight 2.0.0 (2) verification — October 20, 2026

## Clerk configuration

Using the existing connected Chrome daemon, added `com.eveokee.app://callback` to the mobile SSO redirect allowlist in **both Production and Development**. Reloaded the native-applications pages to verify the saved rows. Both instances already had the iOS registration `5KQ8K9W7XS` / `com.eveokee.app`; verified it without adding duplicates. No other Clerk configuration was changed.

The app also registers the canonical `com.eveokee.app` callback scheme alongside the existing `eveokee-native` scheme. ClerkKit 1.6.1 defaults to the bundle identifier for its callback scheme and redirect URL.

## Reproduced crash and fix

Built and installed the unmodified branch on iPhone 17 Pro, iOS 26.0, with ad hoc signing and the ignored **dev** configuration. Signed up through ClerkKitUI using a Clerk test email and the development verification code. The app entered Today, then crashed on the first subscription value.

The local crash report `~/Library/Logs/DiagnosticReports/Eveokee-2026-10-20-011756.ips` records `EXC_BREAKPOINT` / `SIGTRAP` on `tokio-runtime-worker`. Its stack includes:

```text
_dispatch_assert_queue_fail
_swift_task_checkIsolatedSwift
closure #2 in BackendStore.observe<A>(_:detail:update:)
Subscribers.Sink.receive(_:)
SubscriptionAdapter.onUpdate(value:)  ConvexMobile.swift:379
```

The original sink callbacks inherited MainActor isolation. A nested MainActor Task could not help because the runtime check happened on entry to the callback. `receive(on: DispatchQueue.main)` now runs **before** the sink, and updates/completions check the connection generation on the actor. Cancellation and error handling remain intact.

Callback audit:

- MusicPlayer's remote-command and AVPlayer KVO callbacks are explicitly `@Sendable`, extract callback data synchronously, and hop to MainActor in a Task. This avoids an inherited actor check on an arbitrary framework callback thread.
- AVPlayer's periodic observer explicitly requests `.main`; NotificationCenter publishers already schedule on the main queue before their sinks. Their `MainActor.assumeIsolated` calls therefore have an explicit scheduling guarantee.
- ConvexTemplateAuthProvider has async MainActor login/token methods and nonisolated synchronous token extraction. It creates no callback closure with inherited actor isolation. The SDK's supplied `onIdToken` is already Sendable; ConvexMobile 0.8.1 pulls fresh tokens by awaiting `loginFromCache`, so this fix adds no token timer or callback.
- Clerk app callbacks are SwiftUI actor-bound tasks and view actions. No additional arbitrary-thread callback registration exists in app code.
- Compared Diary/Music/DiaryMedia/event decoding with `listDiaries`, `getDiary`, `listPlaylistMusic`, and `getDiaryMedia`. Required fields and numeric types match; absent projected fields are optional. ConvexMobile catches decoding errors and emits ClientError failure, which the store displays. There are no forced decodes/casts in this path. Existing force unwraps in grouping/lyrics are protected by non-nil/nonempty construction.

## Real dev simulator verification

With the fix on the same iOS 26.0 simulator:

- Persisted Clerk session restored; both list subscriptions completed without crashing.
- Created a text diary in-app; the live subscription displayed its star, then the backend's generated memory event.
- Opened the original diary anchor, Today, My Sky, and The Song. My Sky showed one kept entry; The Song displayed the two real moments and its empty music state.
- Signed out, signed in again using email code, and confirmed the persisted diary/event reloaded after the loading indicator disappeared.
- No new Eveokee crash report appeared after the fix. Relaunched the final installed build 2 after the UI tests and confirmed its dev configuration and persisted diary/event again.

This test account has **no playable song**. Real streaming, lock-screen commands, interruptions, native Apple authentication, token refresh over an extended session, and physical-device behavior remain unverified. The automated fixture song test covers navigation, lyric seeking, and source anchors without pretending that audio played.

No backend code, Convex environment variables, or production records were changed. The only new data is the development test account and its diary/event.

## Automated commands

All xcodebuild commands ran from `apps/ios` with `-project Eveokee.xcodeproj -scheme Eveokee -configuration Debug -destination 'platform=iOS Simulator,id=45EF0D86-DB60-45D7-98CE-1CE0E8D4AF60' -derivedDataPath ./DerivedData CODE_SIGN_IDENTITY=-`.

- Baseline `build`: PASS; reproduced the runtime crash above.
- Initial fixed `build`: compile failure when explicitly Sendable Notification closures attempted to pass non-Sendable Notification into an actor closure. Kept their existing main-queue scheduling instead; Sendable remains explicit at the arbitrary-thread KVO/remote boundaries.
- `test -only-testing:EveokeeTests -resultBundlePath /tmp/eveokee-build2-unit.xcresult`: compile failure from the same Notification annotation, before any test executed.
- `test -only-testing:EveokeeTests -resultBundlePath /tmp/eveokee-build2-unit-r2.xcresult`: **PASS, 9 tests** (6 existing model tests, 3 new background value/error/cancellation regressions).
- `test -only-testing:EveokeeUITests -resultBundlePath /tmp/eveokee-build2-ui.xcresult`: **PASS, 2 tests**, including large Dynamic Type / Reduce Motion navigation.

`xcodegen generate` regenerated the project after adding the regression test file and again after setting build 2 / the callback scheme. JS tests are not applicable because no JS package changed.

## Distribution

Production archive **PASS**, using the requested `xcodebuild ... archive` invocation with the production publishable key passed privately as a build setting and `CONVEX_URL=https://insightful-squid-847.convex.cloud`. Archive: `/tmp/evbuild/Eveokee-2.xcarchive`.

Verified the archived Info.plist contains version **2.0.0 (2)**, the expected bundle identifier, exact production Clerk/Convex configuration (without printing key values), and the callback scheme. `codesign --verify --deep --strict` **PASS**.

`xcodebuild -exportArchive -archivePath /tmp/evbuild/Eveokee-2.xcarchive -exportOptionsPlist /tmp/evbuild/ExportOptions.plist -exportPath /tmp/evbuild/export-2 -allowProvisioningUpdates`: **PASS**. Apple reported “Upload succeeded”, “Uploaded Eveokee”, and `EXPORT SUCCEEDED`; the uploaded package is processing in App Store Connect. Build **2.0.0 (2)** was submitted for internal TestFlight using the existing export options. No manual dashboard steps remain. Sam should install build 2 after processing, then verify native Apple sign-in and playback/lock-screen controls on his iPhone.
