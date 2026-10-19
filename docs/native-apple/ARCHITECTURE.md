# Native Apple architecture

The native app lives entirely in `apps/ios`; `apps/mobile`, `apps/web`, and `packages/backend` are unchanged. Minimum iOS/iPadOS 26, Swift 6 with complete strict concurrency, XcodeGen and SPM. There is deliberately no package.json, so pnpm's apps glob and Turbo do not discover a new JS package.

## Boundaries and flow

`EveokeeApp` validates development config, configures Clerk once, and owns `@Observable @MainActor` BackendStore and MusicPlayer. AuthenticatedRoot observes Clerk's persisted active session. Session identity/status changes clear playback and reconnect/clear the data store. AppShell owns navigation, selected calendar date, shared geometry namespace, and the currently presented source. Screen views are projections of the observable store; no network work occurs in their rendering bodies.

BackendStore owns one ConvexClientWithAuth and cancellable Combine subscriptions. Authenticate from the cached Clerk session first, then subscribe to diaries and playlist. Selected-day queries resolve only that day's diary details and media. Changing day cancels the prior detail subscriptions; switching account invalidates an epoch so queued callbacks cannot restore previous account data. Cancelled requests cannot overwrite the current epoch. Global data updates rebuild days and stars without a second cache layer. Errors are visible; no fake successful save is shown. Text save calls the existing create mutation and waits for its result, then real subscription data supplies the new star. No music generation, billing, RevenueCat, purchases, or production writes are introduced.

MusicPlayer is the sole AVPlayer/AVAudioSession owner. It selects the preferred day track (primary music first, then ready playable alternative), enables `.playback`, and drives observable time every 150 ms. Timed lyrics use actual word start/end seconds; the fallback spaces nonempty non-section lines evenly over the actual asset duration (metadata initially; AVPlayer duration replaces it when known). Punctuation, newlines, 1.3-second pauses, or eight words delimit timed phrases. Before the first timed word there is no highlighted lyric. Seeking and previous/next line use the same timeline. Background audio is declared in Info.plist; MediaPlayer Now Playing exposes title, Eveokee artist, duration, time and rate. Lock-screen commands support play/pause/toggle/seek. Interruption and headphone unplug pause playback; appropriate interruption completion can resume. Memory sheets pause the song and resume only if it had been playing. A video source uses its own temporary AVPlayer and pauses on dismissal. Sign-out clears the song and Now Playing metadata.

## Schema and DTOs

Swift DTOs use Codable and Sendable. Convex Id<T> is an opaque String, never UUID or integer. All `v.number()` timestamps/counts/durations decode as Double; milliseconds become Date with `/1000`. Missing optional properties decode as nil and unknown response fields are tolerated. Query projections are intentionally smaller than raw table documents.

| Convex source | Swift model | Fields consumed / relationship |
| --- | --- | --- |
| diaries | Diary | `_id`, userId, optional title, content, date, updatedAt, optional primaryMusicId/primaryMusic/events |
| diaryMedia | DiaryMedia | `_id`, diaryId, storageId, mediaType photo/video, contentType, floating fileSize; getDiaryMedia adds optional storage URL (and omits `_creationTime`) |
| music | Music | `_id`, optional diaryId/title/lyric/lyricWithTime/duration/audioUrl/imageUrl/createdAt/updatedAt, status; playlist adds diaryDate, ownershipType, isUnavailable |
| music.lyricWithTime | TimedLyrics / AlignedWord | alignedWords (`word`, startS, endS, optional palign), waveformData, hootCer; seconds, not milliseconds |
| events | MemoryEvent | `_id`, diaryId, happenedAt, title, summary, personIds; getDiary resolves peopleDetails; optional enriched fields ignored unless used |
| people | Person | `_id`, primaryName, optional altNames/relationshipLabel/lastMentionedAt/interactionCount; no direct table scan |
| getDiary peopleDetails | PersonReference | `_id`, **name** (not primaryName), optional role; a resolved projection of people |
| userSongs (playlist implementation) | consumed through Music projection | Playlist is a user's library, and includes shared/unavailable songs; these must not be treated as personal memories |

No table/schema/generation file changes in this lane.

## Existing backend contracts by screen

Verified against `packages/backend/convex/schema.ts`, diaries.ts, diaryMedia.ts, music.ts, events.ts, memory/people.ts, users.ts, auth.config.ts and the Expo DiaryScreen, DiaryView/Edit and Playlist usage.

| Consumer | Function string / exact arguments | Return / reason |
| --- | --- | --- |
| App store, Today, My sky | `diaries:listDiaries`, `{}` | All owned diaries, newest first, with optional primaryMusic projection. Same as Expo DiaryScreen |
| App store, songs / ledger | `music:listPlaylistMusic`, `{}` | Library songs with optional diary metadata, timed lyrics and availability. Same as Expo PlaylistScreen |
| Selected day / source moments | `diaries:getDiary`, `{diaryId: String}` | Optional diary with primary music, events, resolved peopleDetails and tags. Null means gone/not owned |
| Selected day / media stars | `diaryMedia:getDiaryMedia`, `{diaryId: String}` | Array of media with optional signed storage URLs. Empty for missing/not owned |
| Text fallback | `diaries:createDiary`, `{content: String}` | `{_id: String}`. Same as Expo DiaryEditScreen; server sets date=Date.now and schedules memory extraction |
| Optional future event detail | `events:getEvent`, `{eventId: String}` | Enriched owned event with people/tags/mood/arousal words; current UI uses the equivalent getDiary projection |
| Optional future person detail | `memory/people:getPersonDetail`, `{personId: String}` | Person plus recentEvents; current memory sheet displays resolved names/roles and does not call this |

Authentication uses existing Clerk subject ownership. `createDiary` ensures the current backend user; read-only queries may return [] for an unsynced user. No native client use of admin endpoints, service keys, internal queries, or generated API editing. The native read interface is the official realtime Swift client rather than handwritten REST.

## What is a day?

1. Group diaries by `Calendar.current.startOfDay(Date(diary.date / 1000))`. This is the device's local calendar/timezone, including DST; `updatedAt` and `_creationTime` do not move an entry to a different day.
2. Join music by diaryId and/or the playlist's diaryDate, deduplicate by music `_id`, and include primaryMusic returned with diaries even if absent from the playlist. Exclude playlist entries marked shared or unavailable from the personal sky. A playlist-only owned track with diaryDate can retain a day without a loaded diary.
3. Choose a playable primary track, then another playable track, then a ready metadata-only track for an honest unavailable-audio state. Offer other playable tracks in the song menu. Pending-only days remain in the ledger with no playable song.
4. Resolve each selected day's diary to its events/media. The day grouping follows the source diary date, even if an extracted event's happenedAt refers to an earlier day. Event timestamps remain visible in source sheets; we do not silently invent a different ledger date.
5. Today is the current local day, re-evaluated every 30 seconds and on foreground. Empty Today is a useful capture invitation, never silently replaced with an older day. My sky preserves every derived day and links to its song.

The schema has no canonical stored day/timezone, so travelling can regroup existing entries. A future server day key + capture timezone should make this policy explicit. Public createDiary cannot backdate; the text fallback can describe earlier events but is saved to today's diary date. Do not claim retroactive date editing is implemented.

## SDKs, auth and configuration

Pinned in project.yml and the committed SPM Package.resolved:

- [Convex Swift 0.8.1](https://github.com/get-convex/convex-swift/tree/0.8.1), product ConvexMobile. Verified source and compiled `ConvexClientWithAuth`, `AuthProvider`, `subscribe(to:with:yielding:)`, `mutation(_:with:)`, `loginFromCache`, auth refresh callback. [Official Swift overview](https://docs.convex.dev/client/swift/overview).
- [Clerk iOS 1.6.1](https://github.com/clerk/clerk-ios/tree/1.6.1), ClerkKit and ClerkKitUI. Verified source/compiled `Clerk.configure`, persisted session observation, `auth.signInWithApple`, `auth.signOut`, `AuthView`, custom theme colors, and `session.getToken(.init(template: "convex"))`. ClerkKitUI handles email sign-in/up, verification, recovery and any further account steps rather than reimplementing only a happy-path email flow. [Clerk auth reference](https://clerk.com/docs/ios/reference/native-mobile/auth).
- Found the official bridge [clerk/clerk-convex-swift 0.1.0](https://github.com/clerk/clerk-convex-swift/tree/0.1.0) (now under Clerk, not get-convex). Its provider calls `session.getToken()` and forwards default `.tokenRefreshed` tokens. Existing backend auth requires applicationID/audience `convex`. Our small ConvexTemplateAuthProvider explicitly fetches the **existing `convex` JWT template**, using the SDK's validity cache/refresh and Convex's pull refresh callback. It never forwards a default session JWT as a template JWT. The bridge is researched, not added as an unused dependency. No deployment or Clerk dashboard mutation performed.

Config reads `CLERK_PUBLISHABLE_KEY` and `CONVEX_URL` from built Info.plist. project.yml references Config/App.xcconfig which optionally includes ignored Secrets.xcconfig. The example uses `https:/$()/...` because xcconfig otherwise treats `//` as a comment. Only the two requested values were copied from the owner's existing **DEV** Expo .env.local. Config validation accepts pk_test and an HTTPS convex.cloud URL; there is intentionally no production-key path in this phase. Development credentials are never in the generated Xcode project, committed Info.plist or docs. Simulator builds are signed ad hoc (`CODE_SIGN_IDENTITY=-`); never disable signing, because Clerk's Keychain persists the session and requires a signed app. Device Apple auth still needs Sam's signing team, app capability and Clerk/Apple bundle configuration; no signing account or production app configuration was changed.

## Fixtures and verification boundary

Unit tests are under `apps/ios/__tests__`; UI snapshot tests under EveokeeUITests. No test contacts Convex, Clerk or a media CDN. The debug-only `--fixture-preview` launch path bypasses Clerk/Convex and shows a permanent synthetic-data/no-audio banner, using the exact production SwiftUI views and domain grouping/timeline. Fixture tracks deliberately have no audio URL. Release builds cannot activate this route. Test-host launch skips Clerk setup. Production sign-in ornaments use prototype-style decorative points, never a claim to authenticated user data.

`docs/native-apple/screens/README.md` records actual build/test runs and screenshot provenance. Compiling an SDK API proves availability/type compatibility, not a successful signed-in round trip. Real authenticated diary/media retrieval, mutation, token refresh, Apple credential handoff, and real track/lock-screen audio still require interactive authentication if no persisted native session exists.

## Later backend work (recommendations only)

1. A paginated owned-day index/aggregate with stable day key + timezone, bounded detail fetching and retained historical days. Current listDiaries collects the complete history; each selected day adds two subscriptions per diary.
2. Exact provenance: lyric/phrase range → diary/event/media/person IDs, confidence, quote/time offsets, schema version and ownership validation. Until then source the whole diary, never fabricate precision.
3. Capture API accepting happenedAt/timezone and voice storage/transcription job states, plus original words preserved independently of enrichment. Public text create currently sets today's date.
4. A day-song selection/generation API with explicit user intent and a native-friendly progress/error contract. Existing startDiaryMusicGeneration remains per diary and uses server usage limits; no monetization UI is added here.
5. A consistent owned-song availability projection for primaryMusic (including deletion/revocation), renewable storage URLs, and aggregate counts to distinguish entries, events and media without double counting.
6. Later photo/voice/place ingestion with per-source permissions, and video generation only after music/anchors are solid. No integrations, production migrations or schema edits in this branch.

Suggested next phase: Sam signs in against dev; verify restored auth, exact JWT audience, real music background/lock-screen playback and text creation; then implement hold-to-speak and explicit provenance with the backend lane, followed by physical-device motion/accessibility tuning. iPad/Mac and a RealityKit immersive sky reuse the domain models after these contracts settle.
