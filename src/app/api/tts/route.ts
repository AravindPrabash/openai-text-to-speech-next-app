import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { parseScript, generateSrt, TimelineEntry } from "@/lib/parser";
import { generateGeminiSpeech } from "@/lib/gemini-tts";
import {
  getAudioDuration,
  stitchMasterAudio,
  applyStemFilters,
  StemTimingInfo,
} from "@/lib/audio-stitcher";
import { CHARACTERS } from "@/config/characters";

export const runtime = "nodejs";

interface RequestBody {
  script?: string;
  projectId?: string;
}

function getFormattedProjectId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const YYYY = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const DD = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `project_${YYYY}-${MM}-${DD}_${hh}-${mm}-${ss}`;
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY environment variable is missing." },
      { status: 500 }
    );
  }

  try {
    const { script, projectId: customProjectId }: RequestBody = await req.json();

    if (!script || !script.trim()) {
      return NextResponse.json(
        { error: "Script text is required." },
        { status: 400 }
      );
    }

    const segments = parseScript(script);
    if (segments.length === 0) {
      return NextResponse.json(
        { error: "No valid dialogue lines found in script." },
        { status: 400 }
      );
    }

    // Format folder with human-readable date and time: project_YYYY-MM-DD_HH-mm-ss
    const projectId = customProjectId || getFormattedProjectId();
    const publicAudioDir = path.join(process.cwd(), "public", "audio", projectId);
    const stemsDir = path.join(publicAudioDir, "stems");

    await fs.mkdir(stemsDir, { recursive: true });

    const timeline: TimelineEntry[] = [];
    const stemTimingList: StemTimingInfo[] = [];
    let currentTime = 0;

    // Generate stems sequentially
    for (const segment of segments) {
      const charProfile = CHARACTERS[segment.speaker] || CHARACTERS.NARRATOR;
      const rawStemFileName = `raw_${String(segment.index).padStart(2, "0")}_${segment.speaker.toLowerCase()}.wav`;
      const rawStemFilePath = path.join(stemsDir, rawStemFileName);

      const finalStemFileName = `${String(segment.index).padStart(2, "0")}_${segment.speaker.toLowerCase()}.wav`;
      const finalStemFilePath = path.join(stemsDir, finalStemFileName);

      // Synthesize clean dialogue audio with Gemini
      const audioResult = await generateGeminiSpeech({
        speaker: segment.speaker,
        text: segment.text,
      });

      await fs.writeFile(rawStemFilePath, audioResult.buffer);

      // Apply character DSP profile if defined
      if (charProfile.audioFilters && charProfile.audioFilters.length > 0) {
        await applyStemFilters(
          rawStemFilePath,
          finalStemFilePath,
          charProfile.audioFilters
        );
        // Remove temporary raw duplicate
        try {
          await fs.unlink(rawStemFilePath);
        } catch {
          // ignore
        }
      } else {
        await fs.rename(rawStemFilePath, finalStemFilePath);
      }

      // Calculate audio duration after DSP processing
      const duration = await getAudioDuration(finalStemFilePath);
      const startTime = currentTime;
      const endTime = startTime + duration;
      const stemUrl = `/audio/${projectId}/stems/${finalStemFileName}`;

      timeline.push({
        index: segment.index,
        speaker: segment.speaker,
        text: segment.text,
        startTime,
        endTime,
        duration,
        pauseAfterMs: segment.pauseAfterMs,
        stemUrl,
      });

      stemTimingList.push({
        filePath: finalStemFilePath,
        pauseAfterMs: segment.pauseAfterMs,
      });

      currentTime = endTime + segment.pauseAfterMs / 1000;
    }

    // Stitch master MP3 (temporary silence chunks are deleted automatically inside)
    const masterFileName = "master.mp3";
    const masterFilePath = path.join(publicAudioDir, masterFileName);
    await stitchMasterAudio(stemTimingList, masterFilePath, publicAudioDir);

    // Generate timeline.json
    const timelineJsonPath = path.join(publicAudioDir, "timeline.json");
    await fs.writeFile(
      timelineJsonPath,
      JSON.stringify(
        {
          projectId,
          createdAt: new Date().toISOString(),
          totalDuration: currentTime,
          segmentsCount: timeline.length,
          script,
          timeline,
        },
        null,
        2
      ),
      "utf8"
    );

    // Generate subtitles.srt
    const srtContent = generateSrt(timeline);
    const srtFilePath = path.join(publicAudioDir, "subtitles.srt");
    await fs.writeFile(srtFilePath, srtContent, "utf8");

    return NextResponse.json({
      success: true,
      projectId,
      totalDuration: currentTime,
      masterAudioUrl: `/audio/${projectId}/${masterFileName}`,
      timelineUrl: `/audio/${projectId}/timeline.json`,
      subtitlesUrl: `/audio/${projectId}/subtitles.srt`,
      timeline,
      script,
    });
  } catch (error: unknown) {
    console.error("Multi-speaker dialogue pipeline failed:", error);
    const message = error instanceof Error ? error.message : "Failed to generate dialogue audio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
