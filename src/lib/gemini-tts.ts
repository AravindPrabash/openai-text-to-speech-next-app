import { CHARACTERS, CharacterKey } from "@/config/characters";
import { GoogleGenAI } from "@google/genai";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

if (ffmpegInstaller && ffmpegInstaller.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

interface GenerateStemOptions {
  speaker: CharacterKey;
  text: string;
}

export interface GeneratedAudioResult {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Converts raw PCM (L16, 24kHz, mono) buffer to standard WAV format
 */
function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Trims audio from a given start timestamp in seconds to the end
 */
async function trimAudioFromSeconds(
  inputBuffer: Buffer,
  startSec: number
): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const inPath = path.join(tmpDir, `primed-in-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
  const outPath = path.join(tmpDir, `primed-out-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);

  await fs.writeFile(inPath, inputBuffer);

  return new Promise((resolve, reject) => {
    ffmpeg(inPath)
      .setStartTime(Math.max(0, startSec))
      .output(outPath)
      .on("end", async () => {
        try {
          const trimmed = await fs.readFile(outPath);
          await fs.unlink(inPath).catch(() => {});
          await fs.unlink(outPath).catch(() => {});
          resolve(trimmed);
        } catch (e) {
          reject(e);
        }
      })
      .on("error", async (err) => {
        await fs.unlink(inPath).catch(() => {});
        await fs.unlink(outPath).catch(() => {});
        reject(err);
      })
      .run();
  });
}

/**
 * Find exact dialogue start timestamp in seconds using Gemini multimodal audio
 */
async function detectDialogueCutPoint(
  audioBuffer: Buffer,
  targetLine: string,
  apiKey: string
): Promise<number> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    // First 4-6 words of target line
    const targetWords = targetLine.split(/\s+/).slice(0, 5).join(" ");

    const res = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          parts: [
            {
              text: `Analyze the speech in this audio waveform. Find the exact start timestamp in seconds where the speaker says the line beginning with: "${targetWords}". Respond with ONLY a JSON object: {"dialogueStartSec": number}`,
            },
            {
              inlineData: {
                mimeType: "audio/wav",
                data: audioBuffer.toString("base64"),
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(res.text || "{}");
    if (typeof parsed.dialogueStartSec === "number" && parsed.dialogueStartSec > 0) {
      // Back up slightly (0.08s) to ensure the very first plosive/consonant isn't clipped
      return Math.max(0, parsed.dialogueStartSec - 0.08);
    }
  } catch (err) {
    console.warn("Failed to find exact cut point with Gemini:", err);
  }
  return 0;
}

/**
 * Generate speech audio using Gemini Audio TTS.
 *
 * Both CORVUS and BARNABY use acoustic prompt priming to anchor their specific vocal acting
 * persona (register, cadence, emotion) across every single line in an episode, and then
 * the priming preamble is cleanly trimmed so only the character's line remains.
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

  const cleanedText = text
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();

  if (!cleanedText) {
    throw new Error("Cannot synthesize empty dialogue text.");
  }

  // Construct prompt text
  let synthesisPrompt = cleanedText;
  if (profile.useAcousticPromptPrimer) {
    synthesisPrompt = `Read the following line aloud as ${profile.name} (${profile.role}). Tone and delivery: ${profile.deliveryInstruction}\n\nTranscript:\n"${cleanedText}"`;
  }

  const models = [
    "gemini-3.8-flash-tts",
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts",
  ];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [{ text: synthesisPrompt }],
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

      let rawBuffer: Buffer = Buffer.from(part.inlineData.data, "base64");
      const mimeType = part.inlineData.mimeType || "audio/wav";

      if (
        mimeType.includes("pcm") ||
        mimeType.includes("l16") ||
        rawBuffer.toString("ascii", 0, 4) !== "RIFF"
      ) {
        rawBuffer = Buffer.from(pcmToWav(rawBuffer));
      }

      // If acoustic priming was used, slice off the preamble cleanly
      if (profile.useAcousticPromptPrimer) {
        const cutPointSec = await detectDialogueCutPoint(rawBuffer, cleanedText, apiKey);
        if (cutPointSec > 0) {
          rawBuffer = Buffer.from(await trimAudioFromSeconds(rawBuffer, cutPointSec));
        }
      }

      return {
        buffer: rawBuffer,
        mimeType: "audio/wav",
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Attempt with ${model} failed:`, lastError.message);
    }
  }

  throw lastError || new Error("Failed to synthesize audio with Gemini TTS.");
}
