# Product Requirements Document: Dairy Vibes

## Executive Summary

**Product Name:** Dairy Vibes  
**Version:** 1.0  
**Date:** September 2025  
**Author:** Product Team

Dairy Vibes is a mobile journaling application that transforms personal diary entries into unique musical compositions. By combining traditional journaling with AI-powered music generation, the app creates an immersive and emotionally resonant experience for users to document and relive their memories through both text and sound.

## Product Overview

### Vision Statement
To create a revolutionary journaling experience where emotions and memories are preserved not just in words, but in personalized musical compositions that capture the essence of each moment.

### Value Proposition
- **Emotional Expression**: Transform written thoughts into musical experiences
- **Memory Enhancement**: Associate memories with unique soundtracks for stronger recall
- **Creative Outlet**: Combine writing with music generation for dual creative expression
- **Privacy-First**: Secure, personal space for thoughts with optional musical enhancement

### Target Audience

#### Primary Personas

**1. Creative Millennials (25-40)**
- Tech-savvy individuals who diary regularly
- Appreciate innovative ways to express emotions
- Willing to pay for premium creative tools
- Active on social media, may share musical creations

**2. Mental Health Conscious Users (20-50)**
- Use journaling for mental wellness and self-reflection
- Seek therapeutic outlets for emotional processing
- Value privacy and security
- Interested in mood tracking through music

**3. Memory Keepers (30-60)**
- Document life events and daily experiences
- Create digital scrapbooks and memory collections
- Want unique ways to preserve and revisit memories
- May share with family members

## Functional Requirements

### Core Features

#### 1. diary Entry Management

**1.1 Create Entry**
- Simple "Add" button to start new entry
- Rich text editor with basic formatting (bold, italic, lists)
- Auto-save functionality every 30 seconds
- Character limit: 10,000 characters per entry
- Support for emoji insertion
- Date/time automatically captured

**1.2 Save Entry**
- "Done" button for manual save
- Confirmation toast message
- Immediate sync with Convex backend
- Offline capability with sync queue

**1.3 View/Edit Entries**
- Chronological list view of all entries
- Search functionality by text content
- Filter by date range
- Edit existing entries with version history
- Delete entries with confirmation dialog

#### 2. Music Generation

**2.1 Generate Music from Entry**
- "Generate Music" button on entry screen
- Loading state with estimated time (20s - 2 mins)
- Background processing capability
- Push notification when music is ready
- Ability to regenerate music for same entry

**2.2 Music Playback**
- In-app music player with play/pause/seek
- Volume control
- Loop functionality
- Background playback support
- Download music for offline listening

**2.3 Music Management**
- Library of generated music pieces
- Link between diary entry and music
- Ability to delete music while keeping entry
- Share music externally (social media, messaging)

#### 3. User Authentication & Profile

**3.1 Authentication (via Clerk)**
- Email/password signup
- Social login (Google, Apple)
- Biometric authentication (Face ID/Touch ID)
- Password reset flow
- Session management

**3.2 User Profile**
- Display name and avatar
- Account settings
- Privacy preferences
- Subscription status
- Usage statistics

#### 4. Subscription & Billing

**4.1 Subscription Tiers (via Clerk Billing)**

**Free Tier:**
- Unlimited diary entries
- 10 music generations per month


**Weekly Tier ($2.99/week):**
- Unlimited diary entries
- Unlimited music generations


**Monthly Tier ($9.99/month):**
- Unlimited diary entries
- Unlimited music generations

**Yearly Tier ($99.99/year):**
- Unlimited diary entries
- Unlimited music generations

**4.2 Payment Processing**
- In-app purchase integration


## Technical Architecture

### System Architecture

```
┌─────────────────┐
│  React Native   │
│   Mobile App    │
└────────┬────────┘
         │
    HTTPS/WSS
         │
┌────────▼────────┐
│     Convex      │
│  Backend/DB     │
│  (Real-time)    │
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    │         │          │
┌───▼──┐ ┌───▼──┐ ┌─────▼────┐
│Clerk │ │ LLM  │ │Suno API  │
│Auth  │ │ API  │ │(Music)   │
└──────┘ └──────┘ └──────────┘
```

### Technology Stack

**Frontend:**
- React Native (iOS & Android)
- React Navigation for routing
- React Query for API state management
- Async Storage for local caching
- React Native Track Player for audio

**Backend:**
- Convex for serverless backend
- Convex Database for data persistence
- Convex Functions for business logic
- Convex Real-time subscriptions

**External Services:**
- Clerk for authentication/authorization
- Clerk Billing for subscription management
- OpenAI/Anthropic API for lyrics generation
- Suno API (https://sunoapi.org/) for music generation

### Data Models

#### UserAuth Schema
```typescript
interface UserAuth {
  userId: string; // Clerk ID
  email: string;
  createdAt: number;
}
```

#### Users Schema
```typescript
interface User {
  userId: string; // Same Clerk ID as UserAuth
  name?: string;
  subscriptionTier?: string;
  createdAt: number;
  updatedAt: number;
}
```

#### diary Entry Schema
```typescript
interface diary {
  id: string;
  userId: string; // Clerk ID
  title?: string;
  content: string;
  date: number; // Unix timestamp for the diary date
  primaryMusicId?: string; // Soft reference to Music
  createdAt: number;
  updatedAt: number;
}
```

#### Music Schema
```typescript
interface Music {
  id: string;
  userId: string; // Clerk ID (soft reference)
  journalId?: string; // Soft reference to diaries (UUID)
  taskId?: string; // For async grouping/idempotency
  musicIndex?: number; // Index within task: 0 or 1
  audioId?: string; // Should be unique
  title?: string;
  lyric?: string; // Plain text lyrics
  lyricWithTime?: any; // JSONB - structured lyrics with timestamps
  duration?: number; // Duration in seconds
  audioUrl?: string;
  imageUrl?: string;
  status: "pending" | "ready" | "failed";
  metadata?: any; // JSONB - callback data from Suno
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // Soft delete
}
```

### API Specifications

#### 1. Diary Entry APIs

**Create Diary**
```
POST /api/diary
Body: { content: string, title?: string }
Response: { id: string, ...entry }
```

**Update diary**
```
PUT /api/diary/:id
Body: { content?: string, title?: string }
Response: { ...updatedEntry }
```

**Get diaries**
```
GET /api/diary?limit=20&offset=0
Response: { diaries: Entry[], hasMore: boolean }
```

#### 2. Music Generation APIs

**Generate Music**
```
POST /api/music/generate
Body: { entryId: string, style?: string }
Response: { jobId: string, estimatedTime: number }
```

**Get Music Status**
```
GET /api/music/:jobId/status
Response: { status: string, audioUrl?: string }
```

#### 3. Webhook Endpoints

**Suno Webhook**
```
POST /webhooks/suno-music-generation
Headers: { 'X-Suno-Signature': string }
Body: { jobId: string, status: string, audioUrl?: string }
```

### Security Requirements

1. **Data Encryption**
   - TLS 1.3 for all API communications
   - AES-256 encryption for sensitive data at rest
   - End-to-end encryption for diary entries

2. **Authentication**
   - JWT tokens with 1-hour expiry
   - Refresh token rotation
   - Multi-factor authentication option

3. **Authorization**
   - Row-level security in Convex
   - User can only access own data
   - API rate limiting per tier

4. **Privacy**
   - GDPR compliance
   - Data export functionality
   - Right to deletion
   - No data sharing without consent

## User Experience Design

### User Flow

#### Primary Flow: Create Entry with Music

1. User opens app → Home screen
2. Taps "Add" button → New entry screen
3. Writes diary entry
4. Options:
   - Tap "Done" → Entry saved → Return to home
   - Tap "Generate Music" → Entry saved → Music generation started
5. If music generation:
   - Loading screen with progress
   - Push notification when ready
   - Music player appears with generated track

### Screen Specifications

#### 1. Home Screen
- Header with user avatar and say "hi [username]"
- Floating "Add" action button
- List of diary entries (cards) can toggled into calendar view
- Each card shows:
  - Date/time
  - Diary preview (first 100 chars)
  - Music icon if has music
  - Play button for quick music playback

#### 2. Diary Screen
- Minimalist text editor
- Auto-save indicator
- Bottom toolbar:
  - "Done" button
  - "Generate Music" button

#### 3. Music Player Screen
- Album art (generated or default)
- Entry title and date
- Playback controls
- Progress bar
- Share and download buttons
- Link to view diary entry

### Design Principles

1. **Minimalist Interface**: Focus on content, reduce cognitive load
2. **Emotional Design**: Soft colors, gentle animations, calming typography
3. **Dark Mode**: Full dark mode support for late-night journaling


## Implementation Roadmap

### Phase 1: MVP
- Basic authentication with Clerk
- Simple diary entry creation/editing
- Convex backend setup
- Basic UI/UX implementation

### Phase 2: Music Integration
- LLM integration for lyrics
- Suno API integration
- Music player implementation
- Webhook handling
- Push notifications

### Phase 3: Monetization
- Clerk Billing integration
- Subscription tiers implementation
- Payment processing
- Usage tracking and limits
- Premium features

### Phase 4: Enhancement
- Advanced music customization
- Social sharing features
- Export capabilities
- Performance optimization
- Analytics integration


---


