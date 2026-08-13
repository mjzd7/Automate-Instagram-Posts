# Automated Instagram Story & Reels Audio Selection & MP4 Video Pipeline (Approach B)

> **Document Status**: APPROVED SPECIFICATION  
> **Target System**: `Automate-Instagram-Posts` Core Package & Batch Pipeline  
> **Author**: Antigravity AI Engine  
> **Last Revision**: 2026-08-13  

---

## 1. Executive Summary & Architectural Overview

Instagram Reels and Stories with embedded music generate **2.1x higher watch time** and superior algorithmic distribution compared to silent image posts. Reels specifically are the primary driver for massive organic reach and account growth when optimized correctly. However, Meta’s Instagram Graph API enforces strict constraints:
1. **Static JPEG Stories cannot accept native music stickers via API** — copyright music stickers can only be attached manually inside the native mobile app.
2. **Business Accounts face strict commercial music licensing restrictions** — using unauthorized copyrighted songs leads to automated audio muting, video removals, or account strikes.

### The Solution: Approach B (Meta Audio API + FFmpeg MP4 Video Story & Reels Assembly)
We solve this by programmatically querying Meta’s official **Instagram Audio API** (`/v22.0/ig_audio`), selecting commercially cleared tracks (`is_ads_eligible: true`) mapped to post sentiment/category, extracting a peak audio window, rendering an Instagram-compliant 9:16 MP4 video (`H.264` + `AAC 48kHz`), and uploading it as either a Video Story container (`media_type: STORIES`) or a Reel (`media_type: REELS`).

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
│ 4. FFMPEG MP4 VIDEO COMPOSITOR (REELS & STORIES)                                  │
│    • Merges 9:16 Story JPEG + trimmed AAC audio slice                            │
│    • Applies "Ghost Audio" (5-10% vol) & Infinite Loop for Reels                 │
│    • Adds subtle animated audio equalizer / sound badge overlay                  │
│    • Encodes to H.264 (YUV420p) + AAC 48kHz MP4 video                             │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 5. REELS & STORY VIDEO PUBLISH                                                    │
│    Publishes MP4 URL to Instagram Reels/Stories via Composio / Meta Graph API     │
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

## 3. Viral Engagement Strategy for Reels (Research-Backed)

To maximize watch time, saves, and shares specifically on Instagram Reels, the FFmpeg rendering pipeline and posting logic must incorporate these proven strategies for quote pages:
1. **The "Ghost Audio" Mixing Strategy:** When utilizing trending tracks or specific vibes, mix the music volume down to **5%-10%** if voiceovers/TTS are present. This allows the Reel to rank on the trending audio page without distracting from the text.
2. **The 5-7 Second Infinite Loop:** While Stories default to 15 seconds, Reels should ideally be rendered to EXACTLY the length it takes to read the text (e.g., 5-6 seconds), and seamlessly looped. This creates a natural >100% retention rate as viewers re-read the quote.
3. **The Visual Hook (Beat Drop):** The first 2 seconds must capture attention. We sync the initial audio volume fade-in or "beat drop" with text transitions or subtle visual equalizers.
4. **The CTA (Call to Action):** Every generated Reel caption or final frame must include a viral trigger CTA (e.g., *"Save this to remind yourself later"* or *"Tag someone who needs to hear this"*).

---

## 4. Category-to-Sound Mapping Matrix

The audio selection engine maps quote categories to specific acoustic parameters, target BPMs, and search terms:

| Post Category | Musical Style & Genre | Key & Acoustic Tone | Target BPM | Search Query Keywords | Visual Equalizer Accent |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **💡 Stoicism & Mindset** | Deep Ambient Piano / Slow Cinematic | Minor Key, Reverb, Deep Piano | 45–60 BPM | `ambient piano`, `cinematic reflection`, `stoic` | Cyan / Soft Silver (`#A5F3FC`) |
| **👔 Business & Leadership** | Tech Lo-Fi / Minimal Electronic | Rhythmic Synth, Clean Percussion | 75–85 BPM | `tech lofi`, `chillhop`, `focus beats` | Gold / Warm Amber (`#FDE047`) |
| **⚡ Resilience & Discipline** | Dark Orchestral / Epic Drums | Heavy Brass, Powerful Percussion | 95–120 BPM | `epic orchestral`, `cinematic drums`, `motivation` | High-Contrast Orange (`#FB923C`) |
| **🧘 Mindfulness & Peace** | Nature Pad / Ambient Chillwave | Major Key, Soft Pads, Calming | 40–50 BPM | `nature pad`, `meditation ambient`, `calm` | Emerald / Soft Green (`#6EE7B7`) |
| **🔥 Hot Takes & Humor** | Upbeat Funk / Acoustic Strum | Playful Bassline, Upbeat Tempo | 100–125 BPM | `upbeat indie`, `funk groove`, `playful` | Electric Purple (`#C084FC`) |

---

## 5. The 6-Step Audio Selection & Psychological Retention Engine

### Step 1: Mathematical Pacing & Loop Calculation
- Calculate reading time: `(wordCount / 200) * 60 + 1.0` seconds of padding.
- Determine the target duration: If < 15 seconds, set Reel to loop exactly at this duration. If > 15 seconds, cap at 15 for Stories, or allow longer for Reels.

### Step 2: Granular Sentiment & "Vibe" Shortlisting
- The system extracts post metadata (`category`, `mode: "dark" | "light"`, `quoteText.length`) and performs simple sentiment classification (e.g., Struggle/Pain vs. Triumph/Victory).
- Formulates a target BPM (e.g., fast BPM for short punchy quotes, slow BPM for deep/long quotes) and mood to construct an optimized Meta Audio API search request or fallback catalog query.

### Step 3: Meta Audio API Query & Commercial Filter
- Call `/v22.0/ig_audio` with `audio_type=music` or use Local Fallback.
- Filter out any track where `is_ads_eligible === false` (protects Business & Creator accounts from copyright strikes).

### Step 4: Anti-Fatigue Memory (14-Day Frequency Filter)
- Query `posts` DB for `audio_id`s used by this account in the last 14 days (or last 20 posts).
- Exclude previously played tracks to prevent audience banner blindness and audio fatigue.

### Step 5: Peak Audio Extraction & Drop Alignment
- Identify the `peakStartSecond` of the chosen track (e.g. the "beat drop").
- Extract the exact required duration (from Step 1) starting at `peakStartSecond`, ensuring the visual hook syncs with the drop. Apply `0.5s fade-in` and `1.0s fade-out`.

### Step 6: Hybrid Native 4K Reels Generation (The "18M 30fps" Trick)
- To bypass Instagram's aggressive downscaling artifacting (especially on text), all quote image layers are rendered at native 4K (2160x3840 for Reels/Stories or 2160x2700 for feed).
- FFmpeg merges the native 4K image with the audio using a strictly capped 18Mbps bitrate (`-b:v 18M`) and 30fps (`-r 30`).
- This tricks Meta's algorithm into placing the file in a higher processing tier while the 30fps allows maximum bitrate-per-frame to preserve the crispness of the text edges.
- **Fallback**: The pipeline wraps this in a `try/catch` and gracefully degrades to standard 1080p rendering (at 6Mbps) if the 4K render throws an exception or runs out of memory.

### Step 7: FFmpeg MP4 Video Story & Reels Assembly
- Merge 9:16 Story JPEG + Audio AAC stream into an H.264 video.
- Apply "Ghost Audio" (5-10% volume) if TTS/Voiceover is used.
- Ensure the video loops seamlessly for the exact calculated duration.
- Add an animated visual audio equalizer badge so users watching on mute know audio is playing.

---

## ⚠️ 6. Comprehensive Edge Cases & Failure Mitigation Strategy

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

## 📋 7. Actionable Implementation TODO List

### Phase 1: Local Fallback Catalog & Database Tracking
- [ ] Build local royalty-free fallback audio catalog in `data/audio/fallback/` with JSON metadata (BPM, mood, peakStartSecond).
- [ ] Create/Update `packages/core/src/db/repositories/audio.repo.ts` to log audio usage per account (14-day anti-fatigue memory).

### Phase 2: Meta Audio API Client
- [ ] Create `packages/core/src/audio/meta-audio-client.ts` to query Meta `/v22.0/ig_audio` API with retry & timeout handling (ensuring `is_ads_eligible`).

### Phase 3: Selection Logic Engine (`selectStoryAudio`)
- [ ] Create `packages/core/src/audio/audio-selector.ts` implementing the 6-step psychological selection algorithm.
- [ ] Implement mathematical pacing: calculate exact duration based on quote word count (200 WPM).
- [ ] Implement category-to-BPM and sentiment matching logic (Struggle vs. Triumph, Dark vs. Light mode).
- [ ] Add unit tests in `packages/core/test/audio/audio-selector.test.ts`.

### Phase 4: FFmpeg MP4 Video Reels & Story Compositor
- [ ] Create `packages/core/src/images/story-video-compositor.ts` wrapping `fluent-ffmpeg` or `child_process.execFile("ffmpeg")`.
- [ ] Add visual audio equalizer SVG badge generator showing `🎵 Title — Artist`.
- [ ] Implement peak audio extraction based on `peakStartSecond` and calculated duration.
- [ ] Implement infinite looping logic for Reels (matching exact reading time).
- [ ] Implement "Ghost Audio" volume ducking (5-10% target volume) filter.
- [ ] Implement native 4K scaling support in the compositing engine (`composeImage` / `renderFittedText`).
- [ ] Use `colorspace bt709`, `profile main`, and `level 4.0` to force best color accuracy and compatibility on Meta's servers.

### Phase 5: Pipeline Integration & Verification
- [ ] Update `generate-and-publish-batch.ts` to attempt native 4K generation first, falling back to 1080p if an error occurs.
- [ ] Update `generate-and-publish-batch.ts` to generate `data/posts/${account.id}/${dateStr}-${postId}-video.mp4`.
- [ ] Create `publishToReels` to publish videos to Reels (`media_type: REELS`) along with captions containing CTA (e.g. "Save this to remind yourself later").
- [ ] Update `publishViaComposioStories` and `publishToStories` to accept video payloads (`media_type: STORIES`).
- [ ] Add video retention pruning in `pruneOldImages` for `.mp4` files.
- [ ] Run full test suite (`pnpm test`) to ensure 100% green pass.

---

*This document is saved as `docs/INSTAGRAM_STORY_AUDIO_PLAN.md` for team and agent reference.*
