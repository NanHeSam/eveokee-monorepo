# Constellation — native Apple design

Source: `/Users/samhe/Documents/eveokee-design-2026-10/c-constellation/index.html`, its `NOTES.md`, and the parent `BRIEF.md`. Studied the source and the interactive Today, Song, and My sky views in a browser on October 18, 2026. This is a new native design, not a port of the Expo UI. Music is the emotional reward; video lives inside a source memory after the music.

## Product rules

Each trace is a star, each day a constellation, and the accumulated sky a ledger that never resets. Avoid scores, streaks, deadlines, empty-page pressure, and invented autobiographical claims. Capture can happen after the fact. Bring Sam back to a real source so he can remember for himself. A song lets him see the day in third person. Today opens the day's traces; The song moves through them; My sky changes scale without discarding history.

The current backend supports a **song-level source diary**, not exact lyric-to-event attribution. Every lyric that has a source opens that actual diary. The UI explicitly says “source is the whole diary”; rhythmic star illumination is visual accompaniment, not evidence that a particular star produced that line. Never attach lines to random photos or inferred events. A missing source disables the anchor.

## Color and material

| Token | Prototype value | Native use |
| --- | --- | --- |
| ink | `#17171e` | Opaque app/sheet base |
| paper | `#f4e6d5` | Primary readable text |
| dim | `#b9aca9` | Secondary text; brighter than the prototype's smallest footnotes |
| gold | `#e6b17c` | Emphasis, capture, links, selected navigation |
| star | `#ffe8bb` (`#fff1d1` hero) | Luminous points |
| line | `rgba(237,208,179,.15)` | Hairlines and outlines; native uses .26 to improve legibility |
| upper sky | `#1a1c29` | Cool night at top |
| middle sky | `#24202b` | Plum mid-field |
| horizon | `#302429` | Warm city floor |
| city | `#10131c` at .28 | Quiet skyline, never foreground chrome |
| memory | `#3b3037` → `#28252e` | Warm expanded source sheet |

Prototype warmth also comes from radial amber fields (`#9a654b23`, `#a15e4033`), 3.5% grain, and sparse dust. Native uses a static 3×3 `MeshGradient`, a city Shape, and a deterministic Canvas dust field. No bitmap noise is required. Keep text outside luminous blends. With Increase Contrast, darken the sky by 24%, retain opaque paper/dim labels, and raise constellation stroke opacity to .8 and width to 1.2 points. Native sheets supply system focus and dismissal. The app deliberately stays dark; a light theme is not required.

## Typography and space

Use SF for dates, provenance, navigation, controls and body. Use the system serif (New York on iOS) for emotional titles and lyrics, replacing the prototype's Georgia; italic serif plus gold highlights “today”, “zero”, and “still here”. CJK relies on system fallback rather than forcing Latin metrics.

Prototype reference: hero 37/42 px, song title 26 px, current lyric 27/34 px, adjacent lyric 15 px, card title 18–20 px, wordmark 22 px; metadata 9–12 px with 1.8–2.1 px tracking on eyebrows. Native maps these to semantic `.largeTitle`, `.title`, `.title3`, `.subheadline`, `.caption`, `.caption2` with `.system(..., design: .serif)`; use no fixed font sizes for lyrics. Dynamic Type may grow and wrap lines; the containing page scrolls instead of clipping them. The decorative memory glyph is the only large fixed symbol.

Spacing rhythm: 4 / 8 / 12 / 16 / 24 / 28 / 32 points. Outer copy inset 28; cards 24; card padding 16–18; screen width follows the safe area. Reference sky 300 px Today, 248 Song/ledger; native 275/235/255 points with scroll overflow for compact devices and large text. Cards radius 18, memory artwork 18, system sheet radius supplied by iOS. All controls have at least a 44-point target; star targets 48. Screen content, city, and native status/home safe areas remain separate. Current iPad support is adaptive/scrollable; a dedicated multi-column composition comes later.

## Motion specification

| Interaction | Prototype | SwiftUI implementation / intended continuation |
| --- | --- | --- |
| Screen arrival | opacity .55 s; y 15→0 over .7 s; cubic-bezier(.22,1,.36,1) | `withAnimation(.timingCurve(..., duration: .7))`, opacity + offset, shared namespace |
| Shared constellation | orbit reposition 1.7 s; stars .7 s | `matchedGeometryEffect` keyed by opaque moment ID; path separate in Canvas |
| Memory sheet | y 60→0, scale .96→1, .6 s; scrim .4 s | Native sheet for accessible focus/dismissal; use response .6, damping .86 for related capture emphasis, not a custom modal focus trap |
| Song camera | alternate 18 s: x −9, y +5, scale 1.06, rotate 2°; lyric framing 8 s | TimelineView at 30 fps with gentle ±5/3 pt drift during playback; can extend to 8 s line-focused camera interpolation |
| Active star | 3 s pulse, peak 1.22, glow up to 65 px | .7 s illumination transition on lyric index; Canvas/shape glow; no dependency on fabricated audio amplitudes |
| Dust | seeded 62 points; alternate 3–9 s, .12–.55 opacity | Canvas under TimelineView at 20 fps; deterministic points, subtle sinusoidal opacity |
| Sky zoom | positions/size 1 s; opacity .8 s; selected scale 1.35 | 1 s curve, segmented Day/Week/All and MagnifyGesture; selection haptic |
| Press | .5 s scale; tap .95 | Native `ButtonStyle`, .6 response spring and .86 damping |
| Voice rehearsal | hold ≥550 ms; pulse 1.8 s; birth 1.5 s (0→1.9→1); bloom 1.4 s to 18× | **Stub** with explicit coming-soon alert. No recording, fake transcript, or fake saved star. Later capture should use a damped spring, bloom Canvas and `sensoryFeedback(.success)` only on committed save |
| New text moment | no native source in prototype | Mutation confirmation triggers success feedback; real subscription provides star, no optimistic fabricated diary |

Reduce Motion pauses both TimelineViews, removes drift, displacement transitions, pressed scale, zoom movement and custom animation. State changes and actual progress remain. Haptics use `sensoryFeedback`, leaving intensity/system accessibility behavior to the OS. Continuous star animations should pause offscreen; only the active screen is mounted. Playback itself continues across tabs and in background.

## Rendering and interaction model

`ConstellationDay` owns diaries and music; `Moment` is a presentation projection of a diary, linked event, attached photo/video, or song. IDs come from Convex. Decorative dust has no identity or hit targets. Canvas draws dotted connections (prototype .7 px with dash 2/5) while SwiftUI Buttons above it draw and expose the stars. Five-or-fewer traces use the prototype's normalized asymmetric arrangement. Larger constellations use golden-angle placement (2.39996 rad) with sqrt radial spacing. Stable ordering and IDs preserve continuity across screens; inserting extracted events can reposition a dense layout, so persistent per-moment coordinates are a future refinement.

The same namespace ties Today and Song stars. A real photo URL renders as the small rotated thumbnail; other kinds use warm points. Expanded memories show original text, real attached media and resolved people. No fake location maps or synthetic photo thumbnails are shown as user evidence. The song's active visual star advances modulo the visible moments in lyric order; source attribution is independently resolved by diary ID.

My sky renders one cluster per derived day. Day zoom focuses selection; Week shows the selected local calendar week; All shows the full personal ledger, including days whose music is pending/absent. Days with a ready track can play; others open an honest empty song state. Repeated tap on the selected cluster opens its song, as in the prototype. A complete date-labelled disclosure list is the non-overlapping alternative for dense skies and VoiceOver. Larger datasets eventually need spatial LOD and pagination, without ever resetting the history.

## Accessibility

- Each star is a real Button labelled with kind, title, and time, with an original-memory hint. The full “little traces” list is an alternative when targets overlap.
- Cluster labels include complete date, title, entry count and selected trait. Every day is also reachable in a linear list. Zoom uses a labelled Picker and supports pinch without requiring it.
- Decorative dust, paths, skyline and sign-in stars are accessibility-hidden. Source text is selectable; media has labels. Native sheets keep focus contained and support escape/dismiss gestures.
- Lyrics and metadata use semantic fonts. Long lyrics wrap within a ScrollView; there is no fixed-height text clipping. Automatic time updates do not announce every line via VoiceOver. Transport and source links remain independently focusable.
- Time slider uses native adjustable accessibility; play/pause, previous/next lyric, account and sign-out have explicit labels. No capture behavior depends on holding alone; a tap explains the stub and a separate text fallback is available.
- XCTest fixture captures exercise largest accessibility type and a Reduce Motion launch preference; also manually check the real Settings toggles and VoiceOver before shipping (launch preferences alone do not prove OS accessibility settings).

## Apple expansion

Keep data projections, lyric timeline and coordinate generation independent of SwiftUI scene layout. iPad can pair the sky with a source column and a persistent player; Mac can use a NavigationSplitView and keyboard shortcuts without changing the domain. Current target is iOS/iPadOS 26 only.

For visionOS, project normalized coordinates into a shallow room-scale hemisphere using RealityKit entities, keep lyric text on a readable SwiftUI attachment, and let a day cluster open an `ImmersiveSpace`. Use spatial audio emitters tied to a selected day and a single transport/session owner. Keep originals as anchored attachments, provide gaze/pinch and a 2D alternative, honor Reduce Motion and user-controlled immersion. MeshGradient remains the window sky; RealityKit replaces the Canvas in immersive space. Do not move the camera automatically in the immersive version: move light/constellations at comfortable distance, with explicit recentering and an exit control. No visionOS target or RealityKit implementation is claimed in this phase.
