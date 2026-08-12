# Automated Instagram Story Audio Selection & MP4 Video Pipeline (Approach B)

> **Document Status**: APPROVED SPECIFICATION  
> **Target System**: `Automate-Instagram-Posts` Core Package & Batch Pipeline  
> **Author**: Antigravity AI Engine  
> **Last Revision**: 2026-08-11  

---

## 1. Executive Summary & Architectural Overview

Instagram Stories with embedded music generate **2.1x higher watch time** and superior algorithmic distribution compared to silent image posts. However, Meta’s Instagram Graph API enforces strict constraints:
1. **Static JPEG Stories cannot accept native music stickers via API** — copyright music stickers can only be attached manually inside the native mobile app.
2. **Business Accounts face strict commercial music licensing restrictions** — using unauthorized copyrighted songs leads to automated audio muting, video removals, or account strikes.

### The Solution: Approach B (Meta Audio API + FFmpeg MP4 Video Story Assembly)
We solve this by programmatically querying Meta’s official **Instagram Audio API** (`/v22.0/ig_audio`), selecting commercially cleared tracks (`is_ads_eligible: true`) mapped to post sentiment/category, extracting a 15-second peak audio window, rendering an Instagram-compliant 9:16 MP4 video story (`H.264` + `AAC 48kHz`), and uploading it as a Video Story container (`media_type: STORIES`).

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                          BATCH POST GENERATION PIPELINE                           │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 1. QUOTE & CATEGORY SELECTION                                                    │
│    (e.g., Category: "business", Quote: "To lead people, walk behind them.")       │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 2. 9:16 STORY IMAGE COMPOSITOR                                                    │
│    Renders high-res 1080x1920 Story frame + 1:1 post card + Link Sticker target  │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 3. META AUDIO API SEARCH & SELECTOR (`selectStoryAudio`)                          │
│    • Query: Meta Audio API `/v22.0/ig_audio?audio_type=music`                    │
│    • Filter: Category mood, commercial clearance, anti-repetition memory          │
│    • Fallback: Local Royalty-Free Sound Catalog                                   │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 4. FFMPEG MP4 VIDEO STORY COMPOSITOR                                              │
│    • Merges 9:16 Story JPEG + 15s trimmed AAC audio slice                        │
│    • Adds subtle animated audio equalizer / sound badge overlay                  │
│    • Encodes to H.264 (YUV420p) + AAC 48kHz MP4 video                             │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 5. STORY VIDEO CONTAINER PUBLISH                                                  │
│    Publishes MP4 URL to Instagram Stories via Composio / Meta Graph API           │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Meta Instagram Audio API Specification

### Endpoint: Search Audio Assets
```http
GET /v22.0/ig_audio?audio_type=music&user_id={ig-user-id}&access_token={user-access-token}
```

#### Response Structure:
```json
{
  "audio": [
    {
      "audio_id": "587784541076604",
      "title": "Ambient Chill Piano",
      "display_artist": "Royalty Free Sound",
      "duration_in_ms": 180000,
      "audio_type": "music",
      "download_url": "https://scontent.cdninstagram.com/v/t39.2365-6/...",
      "on_platform_audio_preview_link": "https://www.instagram.com/reels/audio/587784541076604",
      "is_ads_eligible": true
    }
  ]
}
```

---

## 3. Category-to-Sound Mapping Matrix

The audio selection engine maps quote categories to specific acoustic parameters, target BPMs, and search terms:

| Post Category | Musical Style & Genre | Key & Acoustic Tone | Target BPM | Search Query Keywords | Visual Equalizer Accent |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **💡 Stoicism & Mindset** | Deep Ambient Piano / Slow Cinematic | Minor Key, Reverb, Deep Piano | 45–60 BPM | `ambient piano`, `cinematic reflection`, `stoic` | Cyan / Soft Silver (`#A5F3FC`) |
| **👔 Business & Leadership** | Tech Lo-Fi / Minimal Electronic | Rhythmic Synth, Clean Percussion | 75–85 BPM | `tech lofi`, `chillhop`, `focus beats` | Gold / Warm Amber (`#FDE047`) |
| **⚡ Resilience & Discipline** | Dark Orchestral / Epic Drums | Heavy Brass, Powerful Percussion | 95–120 BPM | `epic orchestral`, `cinematic drums`, `motivation` | High-Contrast Orange (`#FB923C`) |
| **🧘 Mindfulness & Peace** | Nature Pad / Ambient Chillwave | Major Key, Soft Pads, Calming | 40–50 BPM | `nature pad`, `meditation ambient`, `calm` | Emerald / Soft Green (`#6EE7B7`) |
| **🔥 Hot Takes & Humor** | Upbeat Funk / Acoustic Strum | Playful Bassline, Upbeat Tempo | 100–125 BPM | `upbeat indie`, `funk groove`, `playful` | Electric Purple (`#C084FC`) |

---

## 4. The 5-Step Audio Selection & Video Assembly Pipeline

### Step 1: Category & Sentiment Query Formulation
The system extracts post metadata (`category`, `mode: "dark" | "light"`, `quoteText.length`) to construct an optimized Meta Audio API search request.

### Step 2: Meta Audio API Query & Commercial Filter
- Call `/v22.0/ig_audio` with `audio_type=music`.
- Filter out any track where `is_ads_eligible === false` (protects Business & Creator accounts from copyright strikes).

### Step 3: Anti-Repetition & Frequency Cap Filter
- Query `posts` DB for track IDs used by this account in the last 20 published posts.
- Exclude previously played tracks to prevent audio fatigue.

### Step 4: 15-Second Peak Audio Trimming
- Determine `peakStartSecond` (default `00:08` to skip silent intro).
- Extract 15-second audio segment with `0.5s fade-in` and `1.0s fade-out`.

### Step 5: FFmpeg MP4 Video Story Assembly
- Merge 9:16 Story JPEG + 15s Audio AAC stream into an H.264 video.
- Add an animated visual audio equalizer badge in the story corner so users watching on mute know audio is playing.

---

## ⚠️ 5. Comprehensive Edge Cases & Failure Mitigation Strategy

| # | Edge Case / Risk | Root Cause | Technical Mitigation & Fallback Strategy |
| :--- | :--- | :--- | :--- |
| 1 | **Commercial Music Licensing Strike (Audio Mute)** | Business account using non-commercial track | **Strict `is_ads_eligible: true` Filter**: Reject any track not cleared for third-party commercial use. |
| 2 | **Meta Audio API Downtime or Rate Limit (429/500)** | Meta API limits audio queries to 10 req/sec | **Local Royalty-Free Catalog Fallback**: Maintain a local fallback library (`data/audio/fallback/`). If API fails, select from local fallback. |
| 3 | **Expired `download_url` Signature** | Meta CDN URLs expire after a short TTL | **Immediate Ingest Pipeline**: Download audio buffer immediately during batch generation; store in temporary local buffer before FFmpeg pass. |
| 4 | **User Watching Story on Mute** | 70%+ of users watch IG Stories with audio off | **Visual Equalizer Badge**: Render an animated 4-bar SVG audio equalizer overlay in the story corner showing song title (`🎵 Song Title — Artist`). |
| 5 | **FFmpeg Encoding Mismatch / Upload Error** | Unsupported audio sample rate or video codec | **Strict FFmpeg Flag Compliance**: Force `-c:v libx264 -pix_fmt yuv420p -c:a aac -ar 48000 -b:a 192k` (Meta's exact required specs). |
| 6 | **Large MP4 File Retention & Disk Leak** | Generated MP4 videos consume 3–8 MB each | **Retention Pruner**: Auto-delete temporary `.mp4` video files older than 3 days alongside JPEG cleanup (`pruneOldImages`). |
| 7 | **Short / Long Track Duration Mismatch** | Audio track is shorter than 15 seconds | **FFmpeg Audio Looping**: Add `-stream_loop -1` to seamlessly loop short audio clips up to the full 15-second story duration. |

---

## 📋 6. Actionable Implementation TODO List

### Phase 1: Meta Audio API Client & Local Fallback Catalog
- [ ] Create `packages/core/src/audio/meta-audio-client.ts` to query Meta `/v22.0/ig_audio` API with retry & timeout handling.
- [ ] Build local royalty-free fallback audio catalog in `data/audio/fallback/` mapped by category.
- [ ] Create `packages/core/src/db/repositories/audio.repo.js` to log audio usage per account and enforce anti-repetition rules.

### Phase 2: Selection Logic Engine (`selectStoryAudio`)
- [ ] Create `packages/core/src/audio/audio-selector.ts` implementing the 5-step selection algorithm.
- [ ] Implement category-to-BPM and dark/light mode key matching logic (`minor` key for dark mode, `major` key for light mode).
- [ ] Add unit tests in `packages/core/test/audio/audio-selector.test.ts`.

### Phase 3: FFmpeg MP4 Video Story Compositor
- [ ] Create `packages/core/src/images/story-video-compositor.ts` wrapping `fluent-ffmpeg` or `child_process.execFile("ffmpeg")`.
- [ ] Add visual audio equalizer SVG badge generator showing `🎵 Title — Artist`.
- [ ] Implement 15-second audio slice extraction with 0.5s fade-in & 1.0s fade-out.

### Phase 4: Pipeline Integration & Verification
- [ ] Update `generate-and-publish-batch.ts` to generate `data/posts/${account.id}/${dateStr}-${postId}-story.mp4`.
- [ ] Update `publishViaComposioStories` and `publishToStories` to accept video payloads (`media_type: STORIES`).
- [ ] Add video retention pruning in `pruneOldImages` for `.mp4` files.
- [ ] Run full test suite (`pnpm test`) to ensure 100% green pass.

---

*This document is saved as `docs/INSTAGRAM_STORY_AUDIO_PLAN.md` for team and agent reference.*
