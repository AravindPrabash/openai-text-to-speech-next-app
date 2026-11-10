import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { promises as fs } from "fs";
import path from "path";

// Configure paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export interface StemTimingInfo {
  filePath: string;
  pauseAfterMs: number;
}

/**
 * Get accurate audio duration in seconds
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata?.format?.duration;
      if (typeof duration === "number" && !isNaN(duration)) {
        resolve(duration);
      } else {
        // Fallback or default
        resolve(0);
      }
    });
  });
}

/**
 * Generate a silent WAV file of given duration in milliseconds
 */
export async function generateSilenceWav(
  outputPath: string,
  durationMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const durationSec = Math.max(0.05, durationMs / 1000);
    ffmpeg()
      .input("anullsrc=r=24000:cl=mono")
      .inputFormat("lavfi")
      .duration(durationSec)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

/**
 * Concatenates stems and silent pauses into a single master MP3 file.
 */
export async function stitchMasterAudio(
  items: StemTimingInfo[],
  outputMasterPath: string,
  workDir: string
): Promise<void> {
  if (items.length === 0) {
    throw new Error("No audio stems to stitch.");
  }

  // Create concat file list
  const concatListPath = path.join(workDir, `concat-${Date.now()}.txt`);
  const lines: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Absolute paths with escaped single quotes for ffmpeg concat
    lines.push(`file '${item.filePath.replace(/'/g, "'\\''")}'`);

    // If there is a pause defined and it's not the end or pause > 0
    if (item.pauseAfterMs > 0 && i < items.length) {
      const silencePath = path.join(workDir, `silence-${i}-${item.pauseAfterMs}ms.wav`);
      await generateSilenceWav(silencePath, item.pauseAfterMs);
      lines.push(`file '${silencePath.replace(/'/g, "'\\''")}'`);
    }
  }

  await fs.writeFile(concatListPath, lines.join("\n"), "utf8");

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .audioCodec("libmp3lame")
      .audioBitrate("192k")
      .output(outputMasterPath)
      .on("end", async () => {
        // Cleanup concat file
        try {
          await fs.unlink(concatListPath);
        } catch {
          // ignore cleanup errors
        }
        resolve();
      })
      .on("error", async (err) => {
        try {
          await fs.unlink(concatListPath);
        } catch {
          // ignore
        }
        reject(err);
      })
      .run();
  });
}

