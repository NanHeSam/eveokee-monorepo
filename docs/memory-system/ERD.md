# Memory System ERD

## Table of Contents

1. [Data model & ER design](#1-data-model--er-design)
2. [Key user journeys → functions + what they do under the hood](#2-user-journeys--backend-functions)
3. [Edge cases & policies (duplication, regeneration, edits, etc.)](#3-edge-cases--policies)
4. [Implementation notes / priorities](#4-implementation-notes--priorities)

---

## 1. Data model & ER design

I'll write this in a DB-agnostic way (works for Convex or SQL). Types are generic: `id`, `string`, `timestamp`, `json`.

### 1.1. Entities & relationships (ER in words)

- **User**
  - has many Diaries
  - has many Events
  - has many Persons
  - has many UserTags
  - has many DailyDigests (optional)

- **Diary**
  - belongs to one User
  - has zero or more Events (via `diaryId`)

- **Event**
  - belongs to one User
  - belongs to one Diary
  - references zero or more Persons (via `personIds[]`)
  - carries `tags[]` (later mapped to UserThemes)

- **Person**
  - belongs to one User
  - is referenced by zero or more Events

- **UserTag**
  - belongs to one User
  - referenced indirectly by `Event.tags` (via aliases / `canonicalName`)

- **DailyDigest** (optional)
  - belongs to one User
  - references zero or more Events

> **Note:** No hard FK from Event → UserTag is required; the mapping is logical.

---

### 1.2. Table / collection schemas

#### User

Minimal for this feature set:

```typescript
User {
  _id: Id<User>;
  clerkId: string;
  email?: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
}
```

---

#### Diary

Raw text + bookkeeping for extraction.

```typescript
Diary {
  _id: Id<Diary>;
  userId: Id<User>;

  title?: string;
  content: string;          // current editable version
  date: number;             // user-facing date of the diary entry
  
  originalText?: string;    // optional: first version
  version?: number;         // increment on edit

  primaryMusicId?: Id<Music>; // optional music attachment

  updatedAt: number;
}
```

> **Conceptually:** diary is the source of truth; Events are derived views.

---

#### Event

Our core "memory unit" derived from diaries.

```typescript
Event {
  _id: Id<Event>;
  userId: Id<User>;
  diaryId: Id<Diary>;

  // Time
  happenedAt: number;           // resolved from text (e.g. "yesterday")

  // People & context
  personIds?: Id<Person>[];     // can be empty for pure self-reflection
  title: string;                // "Coffee with Tom at the park"
  summary: string;              // 1–2 sentence TL;DR

  // Emotion & salience
  mood?: -2 | -1 | 0 | 1 | 2;   // neg ↔ pos
  arousal?: 1 | 2 | 3 | 4 | 5;  // calm ↔ intense

  anniversaryCandidate?: boolean; // potential yearly reminder
  tags?: string[];                // freeform, normalized lowercase
}
```

**Indexes you probably want:**
- `(userId, happenedAt)` – for timeline & recap queries
- `(userId)` – base filter for everything
- `(diaryId)` – to find events for a diary entry

---

#### Person

Contacts / people in your life.

```typescript
Person {
  _id: Id<Person>;
  userId: Id<User>;

  primaryName: string;          // "Tom"
  altNames?: string[];          // ["Tom W.", "Tom from SF"]

  relationshipLabel?: string;   // "friend from SF", "coworker", etc.

  lastMentionedAt?: number;
  interactionCount?: number;    // denormalized, can be recomputed from events

  // Soft "profile" summarised from events
  highlights?: {
    summary: string;            // "Works at Acme, loves matcha, met at YC 2024."
    lastGeneratedAt: number;
  };
}
```

---

#### UserTag (per-user "grown-up tags")

```typescript
UserTag {
  _id: Id<UserTag>;
  userId: Id<User>;

  canonicalName: string;    // "work", "family"
  displayName: string;      // "Work", "Family"

  aliases?: string[];       // ["work", "job", "career stuff"]
  color?: string;           // optional UI color

  eventCount: number;       // count of events tagged with this theme
  lastUsedAt?: number;
}
```

> **Note:** Themes are built by clustering tags; Events just have `tags: string[]`.

---

#### DailyDigest (Optional)

If you want to precompute daily/weekly recaps instead of computing them on the fly.

```typescript
DailyDigest {
  _id: Id<DailyDigest>;
  userId: Id<User>;
  date: string;              // "2025-04-16" (ISO date, no time)

  // Store derived text + which events were used
  summary: string;           // "Today you had coffee with Tom, ..."

  highlightEventIds: Id<Event>[]; // for cards in UI

  generatedAt: number;
}
```

---

## 2. User journeys & backend functions

I'll outline the key flows and name the main functions. Think of these as Convex mutations/queries + some background jobs.

### 2.1. Journey: user writes & saves a diary

#### Front-end flow

1. User writes text, adds photos.
2. Taps Save.
3. App:
   - calls `createDiary`
   - navigates either to:
     - a "Diary detail" screen, or
     - back to Timeline; either is fine.
4. Optionally, if events arrive quickly, you show a "Memory preview" panel.

#### Backend functions

**`createDiary(userId, content, date, ...)`**

- Creates a new Diary:
  - `content`, `originalText = content`, `version = 1`
  - `date`, `updatedAt`
- Enqueues `processDiary(diaryId)` as a background job.
- Returns the Diary for UI.

**`processDiary(diaryId)`**

Runs in background after save (and on manual regenerate):

1. Load Diary.
2. Call `extractEventsFromDiary(diary)` (LLM).
3. Get proposed events:
   - titles, summaries, mood/arousal, people names, tags.
4. For each proposed event:
   - resolve `happenedAt`.
   - call `resolvePeopleForEvent(userId, proposedPeople[])` → `personIds[]`
   - call `normalizeTags(userId, proposedTags[])`.
5. Delete existing Events for this `diaryId`.
6. Insert new Events.
7. Update Person stats and UserTag stats.

**`extractEventsFromDiary(diary)`**

- Pure LLM call.
- **Input:**
  - the diary content
  - diary date
- **Output (JSON):**
  - events list with details.

---

### 2.2. Journey: editing a diary

**UX decision you made:**
Editing diary does not automatically regenerate events (to avoid surprising the user if they've already tweaked events).

#### Front-end flow

1. User opens a Diary detail screen.
2. Edits text.
3. Taps Save changes.
4. App:
   - calls `updateDiary`
5. UI shows:
   - existing events (old interpretation)
   - a subtle button: "Regenerate events from diary" (if they want to resync).

#### Backend

**`updateDiary(diaryId, newContent)`**

- Updates:
  - `content = newContent`
  - `version += 1`
  - `updatedAt = now()`
- Does NOT call `processDiary` automatically.

**`regenerateEventsForDiary(diaryId)`**

- Called when user taps "Regenerate events from diary".
- Internally just calls `processDiary(diaryId)`.

---

### 2.3. Journey: editing events manually

Sometimes user prefers to tweak events instead of regenerating.

#### Front-end

- On an Event detail screen:
  - user can edit:
    - title
    - summaries
    - tags (chips)
    - people chips (add/remove)
    - mood/arousal

#### Backend

**`updateEvent(eventId, patch)`**

- Applies a partial update.
- Updates related stats (Person interaction count, Theme usage) if needed.

---

### 2.4. Journey: viewing Timeline

#### Front-end

- Timeline screen calls:
  - `getTimelineEvents(userId, range)`.

**`getTimelineEvents(userId, range)`**

- **Input:**
  - `userId`
  - `range`
- **Returns:**
  - events with attached Person minimal data.

---

### 2.5. Journey: viewing a Person page

#### Front-end

- Person screen calls:
  - `getPersonDetail(userId, personId)`

**`getPersonDetail(userId, personId)`**

- Loads Person.
- Loads recent events.
- Optionally computes per-person themes.

---

### 2.6. Journey: viewing Themes

#### Front-end

- Themes screen calls:
  - `getUserThemes(userId)` to list themes
  - Tap a theme → opens theme detail:
    - calls `getEventsForTheme(userId, themeId)`

**`getUserThemes(userId)`**

- Returns visible themes.

**`getEventsForTheme(userId, themeId)`**

- Fetches Events matching the theme.

---

### 2.7. Journey: daily / weekly recaps (background)

**`generateDailyDigestForUser(userId, date)`**

- Queries events for the date + past years.
- Asks LLM for summary.
- Stores in DailyDigest.

---

## 3. Edge cases & policies

Here's a checklist of the tricky bits and how to handle them.

### 3.1. Diary edits vs event regeneration

- **Default:** editing a diary does not auto-regenerate events.
- **User can:**
  - edit events directly, or
  - tap "Regenerate from diary" to nuke & rebuild all events for that entry.

### 3.2. Zero / multiple events per diary

- LLM extraction can return:
  - `events: []` → no events created.
  - `events: [ ... up to N ]` → multiple events created.

### 3.3. Ambiguous people ("which Mike?")

- `resolvePeopleForEvent`:
  - tries deterministic matching.
  - if ambiguous, mark in meta (and maybe prompt user later in UI).

### 3.4. Duplicate people

- **Merging:**
  - In UI, allow "merge Person A into Person B".
  - **Backend merge:**
    - Replace A with B in all Events.
    - Recalculate stats.
    - Mark A as merged/deleted.

### 3.5. Tag / theme explosion

- Limit LLM tags per event.
- Promote tags to UserTheme only when frequency thresholds are met.

### 3.6. Orphaned people / themes

- If a Person ends up with `interactionCount = 0`:
  - either keep or mark as stale.

### 3.7. Pipeline updates (new model / prompt)

- **Option:** re-run lazily when user opens an old diary and explicitly taps "Regenerate".

### 3.8. Long-running jobs & retries

- `processDiary` should be idempotent and safe to retry.

---

## 4. Implementation notes / priorities

### Phase 1 – Core data & basic flows

1. **Implement data model:**
   - User, Diary, Event, Person.
   - Minimal UserTheme.

2. **Implement flows:**
   - `createDiary`
   - `processDiary` (LLM extraction + event creation)
   - `updateDiary`
   - `regenerateEventsForDiary`
   - `updateEvent`
   - `getTimelineEvents`
   - `getPersonDetail`

3. **Frontend:**
   - Timeline showing events.
   - Person list & Person detail screen.
   - Diary editor with "Regenerate events from diary" button.
   - Event detail screen.

### Phase 2 – Themes & basic recap

4. **Implement basic UserTheme logic.**
5. **Add a simple daily recap.**

### Phase 3 – UX polishing & consolidation

6. **Person & tag consolidation UX.**
