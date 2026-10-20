# TestFlight 2.0.0 (3) — October 20, 2026

## Delivered

Today now has one constellation hero and one primary voice control, one state-dependent line, small date, Settings sheet, a quiet typing fallback and a conditional song card. English/Chinese labels wrap; complete titles are available in the moments list and source sheet. Song-title stars and identical diary/event titles no longer duplicate the sky. At accessibility sizes, spatial labels yield to the full wrapping list, the brand/date stay compact, and capture options stack within a scrolling page.

Voice capture uses iOS 26 SpeechAnalyzer / progressive SpeechTranscriber, AssetInventory installation when required, PCM conversion/copying, and on-device SFSpeechRecognizer fallback for unsupported analyzer locales/devices. Preferred Chinese/English determines the initial locale; a deliberate selection persists. Hold for 300 ms to start and release to review; short tap starts and a second tap stops. Native Button activation supplies the accessibility action. Final/volatile transcript segments are handled independently and the review text is editable before diaries:createDiary. Permissions, cancellation, interruption, route loss and delayed finalization are handled. No voice audio is uploaded or stored.

“Make today's song” is explicit and guarded against repeated taps. It uses the most recent diary, fetches current content and sends exactly that diary's content/ID to music:startDiaryMusicGeneration. ALREADY_IN_PROGRESS, usage limits, failed rows, action errors and the pending-row scheduling gap are handled without automatic paid retries. See ARCHITECTURE.md for the per-diary limitation and the unavoidable concurrent-edit race in the existing overwrite API.

No backend files, Convex environment variables, production data, Expo or web code changed. All committed screenshots use the Debug fixture route with its permanent synthetic-data banner.

## Live DEV verification

Installed the final Debug build on iPhone 17, iOS 26.0 (device EAF51323-1B31-4992-B10B-30AB21D06734). Verified the installed plist has build 3, a test Clerk key and a non-production Convex URL without printing keys. Used a synthetic Clerk test account and code verification. A signup password was entered privately; no credentials are committed.

- Created a bilingual, synthetic moment by typing. Its star appeared through the live diary subscription; the extracted event arrived afterwards. The source text was retained.
- Tapped **Make today's song exactly once**, at 18:13:36 UTC. The app showed composing, then a ready song roughly 90 seconds later. No retry, second generation or backend mutation outside the app was used. The ready track survived a reinstall/relaunch and persisted Clerk session restore.
- Opened the ready track in The song. AVPlayer elapsed time advanced from 0:00 to 0:08 and 0:22 of 1:59. Actual aligned lyrics changed in both English and Chinese, and the player supported pause. This was a real DEV stream, not fixture audio. The UI reported the timed-lyric path (“Following the light”).
- On the final build, started the real song, returned to Today, recorded/stopped, dismissed review and returned to The song. Playback had resumed automatically and advanced to 1:23 with a Pause control, verifying capture restores the prior playback session.
- Found a physical-tap defect in the first gesture implementation despite hold working. Replaced the failing exclusive gesture with a native Button plus a touch-duration gesture that explicitly dispatches short tap or hold/release. Added a UI regression that exercises both.
- Verified denied microphone access shows a readable explanation, Open Settings and Type instead. Granted microphone access and accepted speech permission; tap entered “Listening on device…”, and stopping opened editable review. Hold/release also reaches review after permissions are ready.
- The simulator received no transcript from synthesized speech played through the host's speakers. It has no supported simctl file-audio injection path here. Recording setup/review/permissions are verified; **actual spoken-word recognition, locale asset download and physical microphone quality remain physical-device checks**. The offline transcript→edit→save test covers Chinese/English final/partial assembly and the exact reviewed content reaching the save operation. No fake transcript was used as evidence of successful recognition.

## Automated command history

All invocations ran from the worktree root. No JS package changed; pnpm tests are not applicable.

Common xcodebuild arguments:

```sh
-project apps/ios/Eveokee.xcodeproj -scheme Eveokee -configuration Debug \
-destination 'platform=iOS Simulator,id=45EF0D86-DB60-45D7-98CE-1CE0E8D4AF60' \
-derivedDataPath apps/ios/DerivedData CODE_SIGN_IDENTITY=-
```

- `xcodegen generate --spec apps/ios/project.yml`: PASS after source/settings changes.
- `xcodebuild <common> build` (`/tmp/eveokee-build3-build.log`): compile failure in an accessibility action modifier; corrected before tests.
- `xcodebuild <common> -resultBundlePath /tmp/eveokee-build3-tests-r1.xcresult test`: compile failure from async XCTest autoclosures; no tests ran; corrected.
- `xcodebuild <common> -resultBundlePath /tmp/eveokee-build3-tests-r2.xcresult test`: 15 unit tests PASS; 3/4 UI tests PASS. Full-title navigation exposed a list/source sheet handoff and ambiguous test locator; fixed both.
- `xcodebuild <common> -resultBundlePath /tmp/eveokee-build3-tests-r3.xcresult test`: PASS, 15 unit + 4 UI tests, including accessibility capture navigation.
- `xcodebuild <common> -resultBundlePath /tmp/eveokee-build3-tests-r4.xcresult test`: PASS, 17 unit + 4 UI tests, after adding stale-session and old-failed-row regressions and refining capture preparation cancellation.
- `xcodebuild <common> -resultBundlePath /tmp/eveokee-build3-tests-r5.xcresult test`: 17 unit tests PASS; 4/5 UI tests PASS. The newly added physical short-tap regression failed; fixed the gesture dispatch.
- `xcodebuild <common> -resultBundlePath /tmp/eveokee-build3-tests-r6.xcresult test`: **PASS, 17 unit + 5 UI tests (22 total), zero failures or runtime warnings**. The capture regression exercises a short tap and a 0.8-second hold separately. This is the final tested implementation.
- `git diff --check`: PASS.

Tests cover DTOs, day/DST grouping, exact fresh per-diary generation content, duplicate request prevention, pending→ready projections, old failed rows, result codes/errors, sign-out during a fresh read, background Combine delivery/cancellation, transcript review/save/failure/empty handling, full titles, Settings, four Today states, navigation/lyrics/anchors and largest Dynamic Type with Reduce Motion launch preferences. No test calls a live paid API. Real Settings/VoiceOver, interruptions/headphones and physical-device speech remain manual checks.

## Screens

The baseline was captured before implementation from the installed build 2 fixture view. Final screenshots were exported from the passing r6 UI test result bundle:

- `screens/build3-before-today.png`
- `screens/build3-today-empty.png`
- `screens/build3-today-moments.png`
- `screens/build3-today-composing.png`
- `screens/build3-today-ready.png`
- `screens/build3-today-accessibility.png`
- `screens/build3-full-moment-title.png`

## Distribution

Production archive **PASS**, created from the final r6-tested source with the commented production Clerk publishable key read privately from the existing mobile environment file and `CONVEX_URL=https://insightful-squid-847.convex.cloud`. Development Secrets.xcconfig was not changed. Archive path: `/tmp/evbuild/Eveokee-3.xcarchive`.

```sh
xcodebuild -project apps/ios/Eveokee.xcodeproj -scheme Eveokee \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath apps/ios/DerivedData \
  -archivePath /tmp/evbuild/Eveokee-3.xcarchive -allowProvisioningUpdates \
  CLERK_PUBLISHABLE_KEY=<privately supplied production key> \
  CONVEX_URL=https://insightful-squid-847.convex.cloud archive
```

Verified archived Info.plist: **2.0.0 (3)**, bundle `com.eveokee.app`, exact production Clerk key and Convex URL, microphone/speech descriptions, callback scheme and background audio. Entitlements match team `5KQ8K9W7XS`. `codesign --verify --deep --strict /tmp/evbuild/Eveokee-3.xcarchive/Products/Applications/Eveokee.app`: **PASS**. Keys were compared without printing them.

```sh
xcodebuild -exportArchive -archivePath /tmp/evbuild/Eveokee-3.xcarchive \
  -exportOptionsPlist /tmp/evbuild/ExportOptions.plist \
  -exportPath /tmp/evbuild/export-3 -allowProvisioningUpdates
```

**PASS**. At 18:22:51 UTC Apple reported “Uploaded package is processing”, “Upload succeeded”, “Uploaded Eveokee” and `EXPORT SUCCEEDED`. Build **2.0.0 (3)** was uploaded for internal TestFlight with the existing distribution options. No merge or backend deploy was performed. Installation becomes available after Apple processing; physical-device speech, asset download, VoiceOver, interruption/headphone and lock-screen checks remain open.
