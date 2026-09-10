# Production music generation incident — September 9–10, 2026

The September 9 production request reached Suno and generated two valid songs. Convex rejected the completion callback because the provider added camelCase fields (including `audioUrl`) and additional metadata to its track objects. Passing those objects directly into a strict internal mutation validator left both music records pending.

A second defect selected `source_audio_url` when `audio_url` was present, even when the source URL was empty. The same issue affected cover images.

## Repair

- Normalize incoming tracks onto an explicit allowlist, accepting both legacy snake_case and camelCase names. Prefer populated aliases when legacy fields are empty. Ignore unrelated provider metadata and invalid optional values.
- Store a nonempty source URL when available, falling back to the regular audio/image URL.
- Preserve and deploy the existing local memory-model change to `openai/gpt-5.4-nano`. A live structured-output request established that the old `google/gemini-3-pro-preview` returns 404 (model not found), while the replacement and the existing highlight model work with the production Gateway key. The SDK's generic “Gateway access failed” message concealed this cause.
- Deploy the backend to `insightful-squid-847` after a successful dry run. No schema/index deletions occurred. The backend function runtime version advanced from 1.28.0 to the already-installed 1.31.0.
- Recover the existing task by fetching its authenticated SUCCESS result from Suno and replaying it through the repaired production callback. Both records became `ready`; timestamped lyrics were saved; both MP3s downloaded with HTTP 200 and decoded fully without errors.

## Fresh production verification

With the owner’s confirmation, a clearly labeled test diary was submitted through `music:startDiaryMusicGeneration` using the owner identity via the authorized Convex CLI. The normal quota/reconciliation path accepted it and reported 98 remaining generations. Suno generated two tracks, and its automatic callback completed successfully at approximately 07:01:31 UTC on September 10. No manual replay was needed for this new request.

The app-facing `diaries:getDiary` query returned “A Fresh Start” as `ready`, with a playable audio URL, 133.4-second duration, 86 timed lyric words, and one extracted memory event. The MP3 downloaded with HTTP 200 and decoded completely with FFmpeg. Production logs confirm successful memory extraction, both timed-lyrics updates, and callback completion without errors. The recovered original diary also returns a ready primary track and 158 timed lyric words through the app query.

## Branch and deployment provenance

`lyric-prompt-rythm` was merged into `main` by PR #52 on December 22, 2025. Its commit `0bc9b2f` is an ancestor of `origin/main` (`701176b`), and their file trees are identical. GitHub CI run 20441165741 successfully deployed Convex and built the web app from that merge. The mobile production binary observed during the audit predates it (December 11, 2025).

Repairs are on `fix/production-music-generation`, based on `origin/main`. The local mobile configuration change remains separate. Production Convex already includes the repair branch's backend changes; merging the repair PR into `main` keeps subsequent deployments consistent and triggers the existing Convex deployment workflow. Mobile builds are disabled in CI; these backend repairs do not require a new native binary.

## Kie account limitation

Both configured Kie development and production keys still return HTTP 200 with application code 500 and: “Your account has been locked. Please contact customer service to ask for specific reasons to unlock your account.”

The signed-in portal shows 9,756 credits, no recent log entries, and no account unlock control or explanation. The existing configured key prefixes match the portal entries. This is not evidence of exhausted credits or a malformed API key. The provider must explain and clear the lock; replacing a key is not an established remedy for an account-level restriction. No keys were rotated. An authorized support email was sent on September 10 asking for the lock reason, reinstatement steps, whether key replacement is needed, and the expected resolution time. No API key values were included.

Kie's portal offers a private Discord support channel under Settings. Its [official common API guide](https://docs.kie.ai/common-api/quickstart) also lists support@kie.ai. A support request can state that both existing API keys return the account-lock error despite a positive portal balance, and ask for the reason and reinstatement steps; it should not include raw API keys.

Music uses the separate `SUNO_API_KEY` at `api.sunoapi.org`, which remains functional. Kie's lock affects the separate video integration.

## Validation

| Command/check | Result |
|---|---|
| `pnpm --filter @backend/convex exec vitest run __tests__/sunoPayload.test.ts` | Initial regression runs failed as expected on the defects; final focused run PASS: 2 tests |
| `pnpm test:backend` | PASS: 317 tests, 27 files after PR review added two empty-alias cases |
| `pnpm lint` (pre-PR check) | PASS: no errors; 10 existing web/mobile warnings |
| `pnpm type-check` (pre-PR check) | PASS: web/mobile; backend script defers to Convex deployment checks |
| `pnpm --filter web type-check` | PASS |
| `git diff --check` | PASS |
| `pnpm --filter @backend/convex exec convex deploy --dry-run --yes --codegen disable` | PASS, including Convex's deployment checks |
| `pnpm --filter @backend/convex exec convex deploy --yes --codegen disable` | PASS, production deployed |
| Live Gateway structured-output probes | Retired Gemini: 404; GPT-5.4 nano and GPT-4o mini: success |
| Existing Suno task recovery | SUCCESS, two ready tracks, HTTP 200 callback, timed-lyrics mutations succeeded |
| `ffmpeg -v error -i <MP3> -f null -` for both recovered tracks and the fresh primary track | PASS: all three full files decode |
| Fresh production generation through the public action | PASS: automatic callback, two ready tracks, timed lyrics, memory extraction and app-facing diary query |

Raw production records, provider responses, and detailed logs were retained only in a local restricted temporary directory, outside Git. The initial audit's broader dependency/native checks are listed in its separate validation table. No dependency upgrade, new native binary release, or Vercel web deployment was needed for this backend repair.
