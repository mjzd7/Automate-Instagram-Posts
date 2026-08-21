import { loadEnv } from "../config/env.js";

export interface ElevenLabsVoiceOptions {
  text: string;
  voiceId?: string; // Default: 'pNInz6obpgDQGcFmaJcg' (Adam) - deep stoic voice
}

export async function fetchElevenLabsVoiceover(options: ElevenLabsVoiceOptions): Promise<Buffer | null> {
  const env = loadEnv();
  if (!env.ELEVENLABS_API_KEY) {
    console.warn("ELEVENLABS_API_KEY not set. Skipping AI Voiceover generation.");
    return null;
  }

  const voiceId = options.voiceId ?? "pNInz6obpgDQGcFmaJcg"; // Adam is a good deep cinematic voice
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: options.text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs API error (${response.status}):`, errorText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Failed to fetch ElevenLabs voiceover:", error);
    return null;
  }
}
