import { CHARACTERS, CharacterKey } from "@/config/characters";

interface GenerateStemOptions {
  speaker: CharacterKey;
  text: string;
}

export interface GeneratedAudioResult {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Generate speech audio using Gemini Audio (gemini-3.8-flash-tts / gemini-2.5-flash-preview-tts)
 */
export async function generateGeminiSpeech({
  speaker,
  text,
}: GenerateStemOptions): Promise<GeneratedAudioResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }

  const profile = CHARACTERS[speaker] || CHARACTERS.NARRATOR;

  // We craft a targeted prompt delivery directing the model to enact the persona
  const prompt = `Read the following line aloud as ${profile.name} (${profile.role}). Tone and delivery: ${profile.deliveryInstruction}

Transcript:
"${text}"`;

  // Models to try in priority order
  const models = ["gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: profile.voiceName,
              },
            },
          },
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          `Gemini API error [${model}] status ${res.status}: ${
            errorData.error?.message || res.statusText
          }`
        );
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.find(
        (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData
      );

      if (!part || !part.inlineData?.data) {
        throw new Error(`No audio data received from Gemini API (${model}).`);
      }

      const audioBuffer = Buffer.from(part.inlineData.data, "base64");
      return {
        buffer: audioBuffer,
        mimeType: part.inlineData.mimeType || "audio/wav",
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Attempt with ${model} failed:`, lastError.message);
      // Continue to fallback model if available
    }
  }

  throw lastError || new Error("Failed to synthesize audio with Gemini TTS.");
}

