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

### 1.9 Multi-Series Engine (`packages/core/src/multi-series/`)

- **Multi-Series Roadmap**: 6 distinct content series designed to target key engagement signals (Saves, DM Shares, Comments, Views):
  - `mindset-manual`: Actionable, bookmarkable frameworks (Target: Saves)
  - `hook-lab`: High-retention cover text & curiosity hooks (Target: Views & Loop Rate)
  - `confession-cards`: Relatable, first-person tension & identity quotes (Target: Likes & Story Shares)
  - `villain-roasts`: Anti-villain roasts with accountability partner DM hooks (Target: DM Shares)
  - `fill-the-blank`: High-engagement interactive prompts with binary comment questions (Target: Comments)
  - `season-reset`: Time-keyed emotional resets (Target: Relevance)
- **Engine Modules**:
  - `generation/generate-pack.ts` + `prompts.ts`: LLM batch generator per series contract with strict validation.
  - `moderation/text-lint.ts`: Moderation filter checking length caps, all-caps ratio, and forbidden lexicon.
  - `images/registry.ts` + `compose-series-card.ts`: High-contrast serif & display font layouts (Playfair, Cormorant, Montserrat).
  - `pipeline/series-batch.ts` + `slot-scheduler.ts`: Series-aware batch runner honoring cadence grid & rate caps.

---

## 2. Current Architecture

```
User Request (GHA cron / manual trigger)
  │
  ▼
generate-and-publish-batch.ts (Legacy) / series-batch.ts (Multi-Series)
  │
  ├─► Content Supply (Quote API vs Content-Pack Queue)
  ├─► Background Provider → fetch candidate images (Pexels/Pixabay/Unsplash)
  ├─► Image-Quote Matcher → embedding similarity scoring
  ├─► Template Selector → high-contrast serif/sans + checkerboard dark/light alternating mode
  │
  ├─► compositor.ts / compose-series-card.ts → 4:5 feed post image (1080×1350, Sharp)
  ├─► compositor.ts → 9:16 reel image (1080×1920, Sharp)
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
| 8 | **Low Organic Reach (<2%) from Generic Content** — Empirical audit revealed generic quotes & low-contrast templates fail; serif (`general-cormorant`) delivers 2x–9x higher views. Signature checkerboard dark/light grid cadence preserved with bolstered typography. | High | Addressed via Multi-Series & Audit |

---

## 4. Pending Tasks

### 🔴 Priority 1 — Critical (Launch Multi-Series & Viral Formats)

#### P1.1: Generate Initial Month-1 Content Packs for All 6 Series
- **Task**: Run `pnpm generate-pack` with an active Gemini/LLM key across the 6 series (`mindset-manual`, `hook-lab`, `confession-cards`, `villain-roasts`, `fill-the-blank`, `season-reset`).
- **Target**: ~5–10 approved items per series in `data/content-packs/<seriesId>/`.

#### P1.2: End-to-End Dry-Run of Multi-Series Pipeline
- **Task**: Execute `pnpm --filter core exec tsx scripts/render-series-samples.ts` and test `src/multi-series/pipeline/series-batch.ts` in dry-run mode.
- **Verification**: Inspect generated 4:5 images and 9:16 reels in `data/dry-run/`.

#### P1.3: Deploy Multi-Series Cron Schedule
- **Task**: Set up GitHub Actions workflow / cron schedule to trigger `run-series-batch.ts` matching the 14-slot weekly cadence grid.

---

### 🟡 Priority 2 — Important (Reels VFX, Audio & Video Optimization)

#### P2.1: 6–7 Second High-Retention Reel Formula
- **Task**: Standardize Reel video durations to 5.5–7.0 seconds with high-density text for >120% loop completion rate.
- **VFX**: Add typewriter text reveal and subtle ambient motion.

#### P2.2: IG Audio Library Integration in Multi-Series Reels
- **Task**: Connect `searchMetaAudioTracks()` with multi-series reel composition to leverage trending audio IDs.

#### P2.3: Dashboard Review Queue Integration
- **Task**: Verify the Next.js web dashboard (`/series`) enables one-click approval, rejection, and preview of pending content pack items.

---

### 🟢 Priority 3 — Polish & Analytics

#### P3.1: Weekly Automated Analytics Sync
- **Task**: Schedule `scripts/fetch-metrics.ts` to sync Instagram Graph API impressions, reach, saves, and shares into `app.db` automatically.

#### P3.2: Automated S7 Monthly Recap Carousel
- **Task**: Automatically compile the top 5 highest-saved posts of the month into a monthly summary carousel.

---

## Summary of Task Priorities

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 🔴 P1.1 | Generate Month-1 Content Packs (6 series) | Very High | Low |
| 🔴 P1.2 | Multi-Series Dry-Run & QA | High | Low |
| 🔴 P1.3 | Deploy Multi-Series Cron Workflow | High | Medium |
| 🟡 P2.1 | 6–7s High-Retention Reel Looper | Very High | Medium |
| 🟡 P2.2 | IG Trending Audio for Multi-Series | High | Medium |
| 🟡 P2.3 | Dashboard Series Approval Flow | Medium | Low |
| 🟢 P3.1 | Automated Weekly Metrics Ingestion | Medium | Low |
| 🟢 P3.2 | S7 Monthly Recap Generation | Medium | Medium |

