import { CharacterKey, CHARACTERS } from "@/config/characters";

export interface DialogueSegment {
  id: string;
  index: number;
  speaker: CharacterKey;
  text: string;
  pauseAfterMs: number;
}

/**
 * Parses script lines formatted as:
 *   SPEAKER: Dialogue text here [pause: 450ms]
 * Supports speaker tags: CORVUS, BARNABY, NARRATOR (case-insensitive in match, canonicalized).
 * Supports inline/trailing pauses like [pause: 500ms] or [pause: 0.5s].
 */
export function parseScript(rawScript: string): DialogueSegment[] {
  const lines = rawScript
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  const segments: DialogueSegment[] = [];
  let currentSpeaker: CharacterKey = "NARRATOR";

  lines.forEach((line) => {
    let cleanLine = line;
    let speaker: CharacterKey = currentSpeaker;

    // Check for SPEAKER: tag prefix
    const speakerMatch = cleanLine.match(/^(CORVUS|BARNABY|NARRATOR):\s*(.*)$/i);
    if (speakerMatch) {
      const parsedSpeaker = speakerMatch[1].toUpperCase() as CharacterKey;
      if (CHARACTERS[parsedSpeaker]) {
        speaker = parsedSpeaker;
        currentSpeaker = parsedSpeaker;
      }
      cleanLine = speakerMatch[2].trim();
    }

    if (!cleanLine) return;

    // Check for pause syntax: [pause: 500ms] or [pause: 0.8s]
    let pauseAfterMs = 200; // default conversational pause between turns
    const pauseMatch = cleanLine.match(/\[pause:\s*(\d+(?:\.\d+)?)\s*(ms|s)\]/i);
    if (pauseMatch) {
      const val = parseFloat(pauseMatch[1]);
      const unit = pauseMatch[2].toLowerCase();
      pauseAfterMs = unit === "s" ? Math.round(val * 1000) : Math.round(val);
      // Remove the pause tag from spoken text
      cleanLine = cleanLine.replace(/\[pause:\s*(\d+(?:\.\d+)?)\s*(ms|s)\]/gi, "").trim();
    }

    if (!cleanLine) return;

    segments.push({
      id: `seg-${segments.length + 1}`,
      index: segments.length + 1,
      speaker,
      text: cleanLine,
      pauseAfterMs,
    });
  });

  return segments;
}

/**
 * Format milliseconds into standard SRT timestamp: HH:MM:SS,mmm
 */
export function formatSrtTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const ms = Math.floor(milliseconds % 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (n: number, z = 2) => String(n).padStart(z, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(ms, 3)}`;
}

export interface TimelineEntry {
  index: number;
  speaker: CharacterKey;
  text: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  duration: number; // in seconds
  pauseAfterMs: number;
  stemUrl: string;
}

/**
 * Generates an SRT string from timeline entries
 */
export function generateSrt(timeline: TimelineEntry[]): string {
  return timeline
    .map((entry, i) => {
      const startMs = Math.round(entry.startTime * 1000);
      const endMs = Math.round(entry.endTime * 1000);
      return `${i + 1}\n${formatSrtTime(startMs)} --> ${formatSrtTime(endMs)}\n[${entry.speaker}] ${entry.text}\n`;
    })
    .join("\n");
}

