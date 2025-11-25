# Evokee Memory System – Concise Project Summary

## What This Project Is

This system transforms user diaries into structured, meaningful memories — without turning journaling into work.

Users write freeform diaries (text + photos/videos).
Behind the scenes, an AI pipeline extracts:

- meaningful Events (moments worth remembering)
- involved People
- contextual Themes (via tags)

Those structured memories power:

- a Timeline of one's life
- People pages (relationship memory)
- Theme-based reflection
- Daily / weekly memory resurfacing

**The core philosophy:**

Journaling stays human. Structure stays invisible. Editing stays optional.

---

## Core Truth Hierarchy

1. Diary is the single source of truth
2. Events are derived interpretations
3. People and Themes emerge from Events

Nothing overrides the diary itself.

---

## Primary Goal

Help users remember, reflect, and emotionally revisit their life — not manage tasks or operate a CRM.

**This is:**

- memory intelligence
- emotional recall
- personal narrative building

**NOT:**

- a productivity tracker
- a rigid knowledge system
- or a fact-policing database

---

## High-Level System Behavior

### Default UX

1. User writes a diary → taps Save
2. Diary saves instantly
3. Background AI creates Events, links People, assigns Tags
4. Timeline updates silently
5. User can optionally edit / refine

No forced decisions. No review requirement.

---

## Core Entities (Conceptual)

- **Diary** → Raw user text
- **Event** → A memorable moment extracted from a diary
- **Person** → Someone appearing across events
- **Theme** → Tag clusters that grow organically per user

**Events can:**

- have multiple people
- have multiple themes
- have emotion + importance scores
- exist or not exist for a diary

---

## Non-Negotiable Guardrails for Engineers

### 1. Never block diary saving

Diary save must always be instant.
All AI work is async.

### 2. Never auto-overwrite user-curated decisions

If user edits an event manually:

- Do NOT regenerate automatically
- Only regenerate when user explicitly taps "Regenerate from diary"

### 3. Diaries can be edited, but extraction is opt-in to rerun

Editing a diary does NOT auto-trigger event regeneration.

### 4. AI is a suggestor, not an authority

LLM:

- proposes events, people, tags
- code + user finalize truth

### 5. Events are disposable, Diaries are not

Regeneration strategy:

- Delete all events for that diary
- Rebuild fresh set from diary text

People and Themes persist across regenerations.

### 6. Everything must scale per-user

No global scans. Always query scoped by:

```
userId + time / tag / person
```

---

## Memory Extraction Pipeline (Simple View)

```
Diary Saved
   ↓
processDiary()
   ↓
LLM creates Event proposals
   ↓
People resolved (consolidated)
   ↓
Tags normalized → Themes updated
   ↓
Events stored
```

**Optional UI layer:**

Memory Preview (editable chips)

---

## Behavioral Style of the System

- Soft intelligence, not rigid categorization
- Emotional prioritization > factual perfection
- Overlap allowed between themes
- Ambiguity is normal and expected
- User correction outranks AI decisions

---

## What NOT to Build

❌ Mandatory review screens  
❌ Forced tagging flows  
❌ CRMs with hard schema dependencies  
❌ Task management logic  
❌ Heavy confirmation modals  
❌ Strict normalization that kills emotion

---

## What to Always Preserve

✅ The original diary  
✅ User agency over AI  
✅ Ability to regenerate  
✅ Emotional context  
✅ Time-based memory reflection

---

## Definition of Success

**A user says:**

> "I feel like my life is being remembered for me."

**Not:**

> "I am maintaining a system."
