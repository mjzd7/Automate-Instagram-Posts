# Automate Instagram Posts — Project Status & Pending Tasks

> **Last updated**: 2026-08-13  
> **Maturity level**: L1 (Standard)

---

## Table of Contents

1. [What Has Been Done](#1-what-has-been-done)
2. [Current Architecture](#2-current-architecture)
3. [Known Issues & Shortcomings](#3-known-issues--shortcomings)
4. [Pending Tasks](#4-pending-tasks)
5. [Reel Critique & Improvement Ideas](#5-reel-critique--improvement-ideas)

---

## 1. What Has Been Done

### 1.1 Core Pipeline (`packages/core/src/pipeline/`)

- **Batch generator** (`generate-and-publish-batch.ts`) — end-to-end pipeline that:
  - Fetches a quote from the quote provider
  - Selects a background image (Pexels / Pixabay / Unsplash providers)
  - Matches quote to background via embedding similarity
  - Picks a template + dark/light mode
  - Composes a 4:5 (1080×1350) feed post image via Sharp
  - Composes a **native 9:16** (1080×1920) reel image from the same raw background (not a crop of the 4:5)
  - Selects audio, downloads it, and creates a Reel MP4 via FFmpeg
  - Publishes feed post (Composio API → Meta Graph API fallback)
  - Publishes Reel (Composio → Meta Graph fallback)
  - Cross-posts to Threads
  - Sends Discord notifications on success/failure
  - Commits composed images to the git repo
  - Prunes old images after 3 days
- **Rate limiting**: 22 posts/day hard cap, posting-hour checks, organic anti-bot gaps (6–15 min between posts)
- **Dry-run mode** for local preview without hitting social APIs
- **Weekend Meta Graph API rotation** (25% forced Meta Graph on weekends to avoid Composio over-reliance)

### 1.2 Image Composition (`packages/core/src/images/`)

- **Feed compositor** (`compositor.ts`) — Sharp-based pipeline:
  - Background resize/crop to 4:5
  - Glass-card overlay with blur
  - Quote text rendering with fitted font sizing
  - Author line rendering
  - Vignette scrim overlay
  - Film grain texture
  - Text drop shadows
  - Supports arbitrary `targetWidth`/`targetHeight` for 9:16 reel images
  - Supports `scale` parameter (2× for 4K generation)
- **4K generation**: attempts 2× scale first, falls back to 1080p on OOM
- **Template system** (`templates.ts`) — multiple visual templates with different fonts, card styles, layout positions
- **Background providers**: Pexels, Pixabay, Unsplash with keyword-based search
- **Suitability scoring** — rates background images for quote-card readability
- **Darkness classifier** — determines dark vs light mode based on background luminance

### 1.3 Reel Video Composer (`packages/core/src/images/reel-video-composer.ts`)

- Converts the native 9:16 composed image into a Reel MP4 via FFmpeg
- **VFX stack** (single FFmpeg `filter_complex` pass):
  - 4000px upscale for jitter-free zoompan
  - **Cosine-wave Ken Burns zoom** — symmetrical 1.0×→1.05×→1.0× so the video loops seamlessly (zoom at frame 0 === zoom at frame N)
  - Cinematic vignette (darkens edges)
  - Unsharp mask for crispness
- **Audio**: AAC 256k, 48 kHz stereo, ghost-volume at 85%, fade-in/fade-out
- **Quality settings**: CRF 17, `preset medium`, `profile high`, BT.709 color space, `+faststart`
- Render4K flag for 24 Mbps bitrate (vs 12 Mbps standard)
- Silent audio injection when no track available (Instagram requires audio stream)

### 1.4 Audio System (`packages/core/src/audio/`)

- **Meta Audio Client** (`meta-audio-client.ts`) — queries Meta's `/v22.0/ig_audio` API for commercial music
  - Filters by `is_ads_eligible: true` to prevent copyright mutes
- **Audio Selector** (`audio-selector.ts`) — 6-step selection engine:
  - Mathematical pacing based on quote word count (200 WPM reading speed)
  - Duration clamping (5–15s)
  - Commercial filter (ads-eligible only)
  - Anti-fatigue memory (filters recently used tracks)
  - Mood/vibe matching (dark mode → ambient/mindset, light mode → upbeat/motivation)
  - Peak audio extraction (8s offset for beat drop)
- **Fallback catalog**: 4 royalty-free tracks stored in `data/audio/fallback/` (mindset, business, motivation, mindfulness)
- **Volume fix**: ghostVolume raised from 0.05 (inaudible) to 0.85

### 1.5 Story System (`packages/core/src/images/story-*.ts`)

- **Story compositor** (`story-compositor.ts`) — dedicated 9:16 story image compositor
- **Story video compositor** (`story-video-compositor.ts`) — converts story images to video
- Stories use the story template; Reels use the feed/post template (as requested)

### 1.6 Instagram Publishing (`packages/core/src/instagram/`)

- **Feed client** (`client.ts`) — Meta Graph API publishing
- **Reels client** (`reels-client.ts`) — Meta Graph API Reels publishing
- **Composio client** — alternative publishing via Composio API (feed + reels)

### 1.7 Supporting Systems

- **Hashtag selector** (`hashtags/selector.ts`) — category-based hashtag selection
- **Caption templates** (`pipeline/caption-templates.ts`) — multiple caption styles with A/B testing
- **Duplicate detector** (`matching/duplicate-detector.ts`) — prevents quote reuse
- **Token encryption** (`crypto/`) — secure credential storage
- **Token refresh** (`pipeline/refresh-token.ts`) — automated IG token refresh
- **Git integration** (`git/commit-batch.ts`) — auto-commit and push composed images
- **Discord notifications** (`notify/discord.js`) — success/failure alerts
- **Threads cross-posting** (`threads/client.ts`)

### 1.8 Infrastructure

- **GitHub Actions** workflow for automated scheduled runs
- **pnpm monorepo** with `packages/core` and `apps/` workspaces
- **Vitest** test suite
- **ESLint** + **Prettier** config
- **Vercel** deployment config for dashboard app

---

## 2. Current Architecture

```
User Request (GHA cron / manual trigger)
  │
  ▼
generate-and-publish-batch.ts
  │
  ├─► Quote Provider → get next quote
  ├─► Background Provider → fetch candidate images (Pexels/Pixabay/Unsplash)
  ├─► Image-Quote Matcher → embedding similarity scoring
  ├─► Template Selector → pick template + dark/light mode
  │
  ├─► compositor.ts → 4:5 feed image (1080×1350, Sharp)
  ├─► compositor.ts → 9:16 reel image (1080×1920, Sharp, same raw background)
  │
  ├─► Audio Selector → pick track (Meta API → fallback catalog)
  ├─► reel-video-composer.ts → 9:16 Reel MP4 (FFmpeg, Ken Burns + VFX + audio)
  │
  ├─► Git commit & push images
  ├─► Public URL hosting (GitHub raw / web app)
  │
  ├─► Publish Feed Post (Composio → Meta Graph fallback)
  ├─► Publish Reel (Composio → Meta Graph fallback)
  ├─► Cross-post to Threads
  └─► Discord notification
```

---

## 3. Known Issues & Shortcomings

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | **Fallback audio tracks are synthetic sine waves** — Replaced with rich multi-harmonic ambient lo-fi soundscapes with low-pass resonance and space reverb. | High | Fixed |
| 2 | **Meta Audio API integration** — Integrated `searchMetaAudioTracks` in pipeline with fallback to `on_platform_audio_preview_link`. | High | Fixed |
| 3 | **Reel video seamless looping** — Implemented symmetrical cosine zoom (`(1.0+0.05*0.5*(1.0-cos(...)))`) so zoom(0) === zoom(D). | Medium | Fixed |
| 4 | **Dual background composition (4:5 + 9:16)** — Sharp now renders native 9:16 full-bleed cutouts directly from raw background buffers alongside 4:5 post cards. | Medium | Fixed |
| 5 | **Image/Video quality optimizations** — Unsharp sharpening filter, High H.264 profile, CRF 17, 24 Mbps 4K bitrate, removed grainy noise overlay. | Medium | Fixed |
| 6 | **Audio volume in Reels** — Raised from inaudible 5% ghost volume to 85% full-bodied audio. | Medium | Fixed |
| 7 | **FFmpeg stream specifier errors** — Fixed filtergraph stream reuse with single-pass full-bleed 9:16 pipeline. | Medium | Fixed |

---

## 4. Pending Tasks

### 🔴 Priority 1 — Critical (Directly impacts reach & engagement)

#### P1.1: Integrate Instagram Audio Library for Reels
**Problem**: We're using self-hosted fallback audio instead of Instagram's trending audio library. Trending audio dramatically increases Reel discoverability via IG's algorithm.  
**Approach**: 
- The Meta Content Publishing API supports an `audio_name` parameter for Reels that references IG library tracks
- Alternatively, use `audio_asset_id` from the `/ig_audio` search endpoint
- Actually call `searchMetaAudioTracks()` in the pipeline before falling back to the catalog
- Research: verify which IG API permissions are needed (`instagram_content_publish` scope may already cover it)

**Files to modify**:
- `packages/core/src/pipeline/generate-and-publish-batch.ts` — call Meta Audio API
- `packages/core/src/instagram/reels-client.ts` — pass `audio_name` or `audio_asset_id`
- `packages/core/src/audio/audio-selector.ts` — integrate Meta API results

#### P1.2: Replace Synthetic Fallback Audio with Real Royalty-Free Tracks
**Problem**: The 4 fallback tracks in `data/audio/fallback/` are FFmpeg-generated sine waves — they sound terrible.  
**Approach**:
- Source real royalty-free ambient/lo-fi tracks (e.g., from Pixabay Audio, Free Music Archive)
- Replace the synthetic MP3 files with real music files
- Update `downloadUrl` in the fallback catalog to point to the new files

#### P1.3: Fetch Two Background Image Versions (4:5 + 9:16)
**Problem**: Currently one background image is fetched and used for both the 4:5 post and the 9:16 reel. The 9:16 version is composed by Sharp from the same source image, but the crop/scale may not be optimal for the taller aspect ratio.  
**Approach**:
- When fetching from Pexels/Pixabay/Unsplash, request two versions: one landscape-ish for 4:5, one portrait for 9:16
- Most providers support orientation/size parameters
- Keep the same image conceptually but get a better native crop for each format

**Files to modify**:
- `packages/core/src/images/background-provider.ts`
- `packages/core/src/images/pexels-provider.ts`
- `packages/core/src/images/pixabay-provider.ts`
- `packages/core/src/images/unsplash-provider.ts`
- `packages/core/src/pipeline/generate-and-publish-batch.ts`

### 🟡 Priority 2 — Important (Quality & retention improvements)

#### P2.1: Improve Reel VFX for Higher Retention
**Problem**: Current VFX is just a cosine Ken Burns zoom + vignette + unsharp. Retention could be higher with more dynamic effects.  
**Ideas**:
- **Text reveal animation**: Fade/typewriter effect for the quote text (requires rendering text as a separate FFmpeg overlay, not baked into the image)
- **Parallax layers**: Separate background blur layer from foreground card, animate at different speeds
- **Color grading**: Subtle warm-to-cool color shift over the duration
- **Light leak / bokeh overlay**: Animated semi-transparent overlay for cinematic feel
- **Subtle particle/dust motes**: Very light animated noise particles

**Constraint**: All must work in a single FFmpeg pass on a 2-vCPU GHA runner within 5 minutes.

#### P2.2: Infinite Video Looping
**Problem**: Instagram Reels loop automatically, but there can be a visible "jump" at the loop point.  
**Current state**: Cosine zoom already ensures zoom(0) === zoom(D) for seamless visual looping.  
**Remaining work**:
- Ensure audio also loops seamlessly (fade-out at end → fade-in at start should feel continuous)
- Consider making the video duration a multiple of the audio's beat/phrase length for musical continuity
- Set MP4 metadata (`-metadata loop=1` or similar) — though Instagram may ignore this

#### P2.3: Image Quality Audit
**Problem**: Image quality reportedly decreased after recent changes.  
**Possible causes**:
1. JPEG compression quality — check Sharp's `.jpeg({ quality: ... })` setting
2. Double-resize: if the reel image is composed at 1080×1920 then re-encoded by FFmpeg, there could be quality loss
3. FFmpeg CRF/bitrate — currently CRF 17 which should be high quality
4. 4K fallback to 1080p happening silently

**Action**: Add quality logging, compare file sizes before/after, verify Sharp JPEG quality is ≥ 90.

### 🟢 Priority 3 — Nice to Have

#### P3.1: A/B Test Reel Durations
- Test 7s vs 10s vs 15s durations
- Track completion rates via IG Insights API
- Auto-adjust duration based on performance

#### P3.2: Caption Optimization for Reels
- Reel captions should be shorter and more hook-oriented than feed captions
- Add reel-specific caption templates
- Include CTA in first line (visible without "more")

#### P3.3: Posting Schedule Optimization
- Analyze when followers are most active
- Shift cron schedule to optimal posting windows
- Consider timezone-aware scheduling per audience

#### P3.4: Dashboard Improvements
- Reel performance metrics
- Audio track performance tracking
- Visual preview of next scheduled posts

#### P3.5: Multi-Account Testing
- Verify the pipeline works correctly with multiple accounts
- Test account-specific template/mode preferences

---

## 5. Reel Critique & Improvement Ideas

### What's Working
- ✅ Native 9:16 composition (not a stretched 4:5 crop)
- ✅ Seamless cosine zoom loop
- ✅ Cinematic vignette
- ✅ High bitrate encoding (12–24 Mbps)
- ✅ BT.709 color space for accurate colors

### What Needs Improvement

| Area | Current State | Improvement |
|------|--------------|-------------|
| **Audio** | Synthetic sine waves / silent | Use IG trending audio or real royalty-free music |
| **Motion** | Single slow zoom only | Add parallax, text reveal, light leaks |
| **Text** | Static baked into image | Animated reveal (fade-in, typewriter) |
| **Duration** | Fixed calculation from word count | A/B test + optimize for completion rate |
| **Background** | Same image cropped for both formats | Fetch native portrait image for reels |
| **Engagement hooks** | None | Add subtle CTA overlay ("Follow for more") |

---

## Summary of Task Priorities

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 🔴 P1.1 | IG Audio Library integration | Very High | Medium |
| 🔴 P1.2 | Replace synthetic audio | High | Low |
| 🔴 P1.3 | Dual background fetch (4:5 + 9:16) | High | Medium |
| 🟡 P2.1 | Enhanced Reel VFX | High | High |
| 🟡 P2.2 | Infinite loop polish | Medium | Low |
| 🟡 P2.3 | Image quality audit | Medium | Low |
| 🟢 P3.1 | A/B test durations | Medium | Medium |
| 🟢 P3.2 | Reel-specific captions | Medium | Low |
| 🟢 P3.3 | Posting schedule optimization | Medium | Medium |
| 🟢 P3.4 | Dashboard improvements | Low | High |
| 🟢 P3.5 | Multi-account testing | Low | Medium |
