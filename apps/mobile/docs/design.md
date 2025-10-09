# Dairy Vibes - Design Specification

## Design Philosophy
**"A creative studio where words become melodies"**

Dairy Vibes embodies the spirit of a vibrant creative studio - energizing, inspiring, and delightfully playful. Drawing inspiration from Duolingo's engaging interface and modern iOS glassmorphism, the app creates a space where journaling feels less like a chore and more like a creative adventure.

---

## Color Palette

### Primary Colors

**Diary (Main)** - Soft Apricot
- Primary: `#FFB5A7` (Soft coral-peach)
- Light variant: `#FCD5CE` 
- Dark variant: `#F08080`
- Usage: Main UI elements, diary cards, navigation

**Music (Accent)** - Macaron Mint
- Primary: `#A8E6CF` (Soft pistachio green)
- Light variant: `#C3F0E2`
- Dark variant: `#7FD8B5`
- Usage: Music-related features, generate button, music player

### Supporting Colors

**Neutral Palette**
- Background: `#FDFBF7` (Warm white)
- Surface: `#FFFFFF` with 80% opacity (glassmorphism)
- Text Primary: `#2D3436`
- Text Secondary: `#636E72`
- Text Tertiary: `#B2BEC3`

**Semantic Colors**
- Success: `#A8E6CF` (Uses music green)
- Warning: `#FDCB6E` (Soft yellow)
- Error: `#FF7675` (Soft red)
- Info: `#74B9FF` (Soft blue)

### Dark Mode Palette
- Background: `#1A1A2E`
- Surface: `#16213E` with 60% opacity
- Card: `#0F3460` with blur
- Text Primary: `#F5F5F5`
- Text Secondary: `#B8B8B8`
- Apricot Dark: `#CD6155`
- Mint Dark: `#52C7A0`

---

## Typography

### Font Family
**Primary:** SF Pro Rounded (iOS) / Rubik (Android)
- Provides the playful, friendly feeling inspired by Duolingo
- Excellent readability for diary entries
- Rounded edges complement the UI's soft aesthetic

**Fallback:** Inter (cross-platform)

### Type Scale
```
Display Large:   32px / 40px line-height / -0.5 letter-spacing
Display Small:   28px / 36px line-height / -0.3 letter-spacing
Heading 1:       24px / 32px line-height / -0.2 letter-spacing
Heading 2:       20px / 28px line-height / 0 letter-spacing
Body Large:      17px / 26px line-height / 0.2 letter-spacing
Body Regular:    15px / 24px line-height / 0.3 letter-spacing
Body Small:      13px / 20px line-height / 0.3 letter-spacing
Caption:         12px / 16px line-height / 0.4 letter-spacing
```

### Diary Entry Typography
- Font Size: 17px (comfortable reading)
- Line Height: 1.7 (spacious, Medium-inspired)
- Paragraph Spacing: 16px
- Max Width: 680px (optimal reading width)
- Letter Spacing: 0.3px

---

## Visual Style

### Glassmorphism Properties
```css
/* Card surfaces */
background: rgba(255, 255, 255, 0.7);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.3);
box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
```

### Border Radius System
- Extra Small: 12px (badges, chips)
- Small: 16px (inputs, small buttons)
- Medium: 20px (cards, modals)
- Large: 24px (primary buttons, major CTAs)
- Extra Large: 32px (bottom sheets, special elements)
- Full: 9999px (pills, tags)

### Elevation System
```css
/* Level 1 - Subtle */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

/* Level 2 - Cards */
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);

/* Level 3 - Floating */
box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);

/* Level 4 - Modal */
box-shadow: 0 16px 48px rgba(31, 38, 135, 0.2);
```

### Spacing System
Based on 8px grid:
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px
- 3xl: 64px

---

## Components Design

### Navigation Bar (Bottom)
```
Height: 80px (includes safe area)
Background: Glassmorphism surface
Icons: 24px outlined icons
Active state: Icon fills with accent color + label appears
Animation: Spring bounce on selection
```

**Tab Items:**
1. 📖 Diary (Home)
2. 🎵 Music Library
3. ✍️ Write (Center, larger button)
4. 📊 Insights
5. 👤 Profile

### Diary Entry Card
```
Background: Glassmorphism white
Border Radius: 20px
Padding: 20px
Margin Bottom: 16px
```

**Structure:**
- Poetic timestamp ("Sunday morning") - Text tertiary, 12px
- Entry preview (2-3 lines) - Body regular
- Bottom row: Mood indicator | Word count | Music badge (if exists)
- Hover: Gentle lift with shadow increase
- Music badge: Mint green pill with play icon

### Music Generation Button
```
Background: Linear gradient (#A8E6CF to #7FD8B5)
Border Radius: 24px
Height: 56px
Animation: Pulse glow when idle, ripple on tap
Icon: Sparkle/wand icon
Text: "Generate Music" in white
```

### Music Player (Spotify-inspired)
```
Full screen takeover
Background: Blurred album art with gradient overlay
Album Art: 320x320px with 16px radius
Controls: Glassmorphism circles
Progress Bar: Thin with thick scrubber
```

**Layout:**
- Top: Minimize chevron, entry link
- Center: Album art (generated abstract art based on mood)
- Title: Entry title or "Untitled Memory"
- Date: Poetic timestamp
- Controls: Previous | Play/Pause (larger) | Next
- Bottom: Volume, Share, Download

### Loading State (Music Generation)
```
Background: Full screen with blur
Center: Animated gradient orb (mint to apricot)
Quote: Rotating inspirational quotes
- "Transforming emotions into melodies..."
- "Every feeling has its own rhythm..."
- "Creating your sonic memory..."
Progress: Subtle progress ring around orb
Time estimate: "About 30 seconds remaining"
```

---

## Micro-interactions & Animations

### Delightful Touches
1. **Entry Save**: Checkmark draws itself with particle burst
2. **Music Generation Start**: Button morphs into loading state
3. **New Entry**: Paper unfold animation
4. **Delete Entry**: Card crumples and falls
5. **Streak Celebration**: Confetti animation on milestones
6. **Tab Switch**: Icons bounce with overshoot
7. **Pull to Refresh**: Pen writing animation
8. **Music Ready**: Notification slides in with musical notes floating

### Animation Timing
- Micro: 200ms (hover states, small transitions)
- Standard: 300ms (page transitions, card animations)  
- Emphasis: 500ms (celebrations, major state changes)
- Easing: `cubic-bezier(0.4, 0.0, 0.2, 1)` (Material standard)

### Spring Animations
```javascript
{
  tension: 100,
  friction: 10,
  mass: 1
}
```

---

## Screen Designs

### Home Screen (Calendar/Timeline View)

**Header**
- "Your Story" title with current month
- Settings gear (top right)

**Calendar Section**
- Month view with dots on days with entries
- Today highlighted in apricot
- Days with music have mint dot
- Swipe to change months

**Recent Melodies Section**
- Horizontal scroll of recent generated music
- Mini album art cards (120x120)
- Play button overlay
- Entry preview on tap

**Timeline Feed**
- Entries grouped by day
- Poetic headers ("Last Sunday", "A week ago")
- Cards with glassmorphism effect
- Smooth scroll with momentum

### Write Screen

**Layout**
- Minimal chrome - just essential UI
- Full-screen text area
- Floating toolbar (bottom)
- Character count (subtle, top right)
- Auto-save indicator (pulsing dot)

**Toolbar Items**
- Format (B/I/U)
- List toggle
- Emoji picker
- Generate Music (prominent mint button)
- Done (apricot text button)

### Empty States

**No Entries Yet**
```
Illustration: Minimalist pen and musical note
Title: "Every journey begins with a single word"
Subtitle: "Write your first entry and watch it come to life"
CTA: "Start Writing" (gradient button)
```

**No Music Yet**
```
Illustration: Abstract waveform waiting to be filled
Title: "Your melodies await"
Subtitle: "Generate music from any diary entry"
```

---

## Responsive Behavior

### Breakpoints
- Small phones: 320-374px
- Standard phones: 375-413px
- Large phones: 414-767px
- Tablets: 768px+

### Adaptations
- Font scales down 1-2px on small phones
- Card padding reduces on small screens
- Tab labels hide on smallest screens
- Music player adapts album art size

---

## Dark Mode Adaptations

### Automatic Switching
- Sunset: Gradually fade to dark (30min transition)
- Sunrise: Gradually fade to light (30min transition)
- Manual override available in settings

### Dark Mode Specific
- Glassmorphism uses dark surface colors
- Reduced blur intensity (15px instead of 20px)
- Increased border opacity for definition
- Mint green becomes more vibrant
- Apricot becomes dusty rose

---

## Accessibility

### Standards
- WCAG 2.1 AA compliance
- Minimum contrast ratio: 4.5:1 (normal text)
- Large text contrast: 3:1
- Touch targets: Minimum 44x44px

### Features
- VoiceOver/TalkBack optimized
- Dynamic Type support (iOS)
- Reduced motion option
- High contrast mode
- Font size adjustment (up to 200%)

---

## Icon Library

### Style Guidelines
- 24x24px default size
- 2px stroke weight
- Rounded line caps
- Consistent corner radius
- Outlined style (filled on selection)

### Core Icons
```
diary:     📖 Book open
Music:       🎶 Musical note
Write:       ✍️  Pen/Quill
Profile:     👤 User circle
Settings:    ⚙️  Gear
Play:        ▶️  Triangle
Pause:       ⏸️  Two bars
Generate:    ✨ Sparkles
Calendar:    📅 Calendar
Mood:        😊 Smile variants
Share:       ↗️  Share arrow
Download:    ⬇️  Download arrow
Delete:      🗑️  Trash
Edit:        ✏️  Pencil
Search:      🔍 Magnifying glass
```

---

## Motion Principles

### Choreography
1. **Stagger**: Multiple elements animate in sequence
2. **Morphing**: Elements transform smoothly between states
3. **Overshoot**: Playful bounce on important actions
4. **Parallax**: Subtle depth on scroll
5. **Elastic**: Spring physics for natural feel

### Performance
- Use transform and opacity only
- Avoid animating layout properties
- GPU acceleration for complex animations
- 60fps target for all animations
- Reduce motion in low-power mode

---

## Sound Design (Future)

### UI Sounds
- Entry save: Soft paper rustle
- Music generation start: Magical chime ascending
- Music ready: Gentle notification melody
- Tab switch: Subtle click
- Delete: Paper crumple

### Haptic Feedback
- Light: Tab selection, toggle switches
- Medium: Save actions, button presses
- Heavy: Delete confirmation, celebrations

---

## Brand Application

### App Icon
- Gradient background (apricot to mint)
- Simple diary + music note symbol
- Rounded square (iOS superellipse)
- Adaptive icon for Android

### Launch Screen
- Gradient background matching icon
- App logo centered
- Subtle loading animation (pulse)
- Quick transition to home

### Marketing Colors
- Primary: Mint green for music features
- Secondary: Apricot for diary features  
- Always show both in balance
- White space is crucial

---

## Implementation Notes

### React Native Specific
- Use `react-native-reanimated` for animations
- `react-native-linear-gradient` for gradients
- `react-native-blur` for glassmorphism
- `react-native-haptic-feedback` for touches
- Custom spring configs for consistency

### Performance Targets
- Initial load: < 3 seconds
- Screen transition: < 300ms
- Touch response: < 100ms
- Animation FPS: 60fps minimum
- Memory usage: < 200MB average

### Testing Requirements
- Test glassmorphism on older devices
- Verify animations at 120Hz (ProMotion)
- Check color contrast in all modes
- Validate touch targets
- Test with system font scaling

---

**Version:** 1.0  
**Last Updated:** September 2025  
**Design System:** Dairy Vibes Creative Studio
