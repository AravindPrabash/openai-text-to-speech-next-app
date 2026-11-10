import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { promises as fs, readFileSync } from "fs";
import path from "path";
import os from "os";

// Configure ffmpeg path
if (ffmpegInstaller && ffmpegInstaller.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

// Locate ffprobe path safely without triggering bundler resolution on README files
function getFfprobeBinaryPath(): string | null {
  try {
    const platform = process.env.npm_config_platform || os.platform();
    const arch = process.env.npm_config_arch || os.arch();
    const target = `${platform}-${arch}`;
    const binary = platform === "win32" ? "ffprobe.exe" : "ffprobe";
    const candidate = path.join(
      process.cwd(),
      "node_modules",
      "@ffprobe-installer",
      target,
      binary
    );
    return candidate;
  } catch {
    return null;
  }
}

const ffprobePath = getFfprobeBinaryPath();
if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath);
}

export interface StemTimingInfo {
  filePath: string;
  pauseAfterMs: number;
}

/**
 * Fast & reliable WAV duration parser directly from file header
 */
function getWavHeaderDuration(filePath: string): number | null {
  try {
    const buffer = readFileSync(filePath);
    if (
      buffer.length >= 44 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WAVE"
    ) {
      let offset = 12;
      let byteRate = 0;
      let dataSize = 0;
      while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString("ascii", offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        if (chunkId === "fmt " && offset + 20 <= buffer.length) {
          byteRate = buffer.readUInt32LE(offset + 16);
        } else if (chunkId === "data") {
          dataSize = chunkSize;
        }
        offset += 8 + chunkSize;
      }
      if (byteRate > 0 && dataSize > 0) {
        return Number((dataSize / byteRate).toFixed(3));
      }
    }
  } catch {
    // Fall back to ffprobe
  }
  return null;
}

/**
 * Get accurate audio duration in seconds
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  const wavDuration = getWavHeaderDuration(filePath);
  if (wavDuration !== null && !isNaN(wavDuration) && wavDuration > 0) {
    return wavDuration;
  }

  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.warn("ffprobe error, falling back:", err.message);
        return resolve(1.5);
      }
      const duration = metadata?.format?.duration;
      if (typeof duration === "number" && !isNaN(duration)) {
        resolve(Number(duration.toFixed(3)));
      } else {
        resolve(1.5);
      }
    });
  });
}

/**
 * Apply character DSP audio filters (pitch drop, EQ warmth, compression) to a WAV stem
 */
export async function applyStemFilters(
  inputPath: string,
  outputPath: string,
  filters: string[]
): Promise<void> {
  if (!filters || filters.length === 0) {
    // If no filters needed, copy or leave as is
    if (inputPath !== outputPath) {
      await fs.copyFile(inputPath, outputPath);
    }
    return;
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(filters)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
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

  const concatListPath = path.join(workDir, `concat-${Date.now()}.txt`);
  const lines: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    lines.push(`file '${item.filePath.replace(/'/g, "'\\''")}'`);

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
        try {
          await fs.unlink(concatListPath);
        } catch {
          // ignore
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
