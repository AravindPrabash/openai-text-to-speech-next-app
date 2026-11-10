import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

export interface ProjectHistoryItem {
  projectId: string;
  formattedDate: string;
  totalDuration: number;
  segmentsCount: number;
  previewText: string;
  script?: string;
  masterAudioUrl: string;
  timelineUrl: string;
  subtitlesUrl: string;
  timeline: Array<{
    index: number;
    speaker: string;
    text: string;
    startTime: number;
    endTime: number;
    duration: number;
    pauseAfterMs: number;
    stemUrl: string;
  }>;
}

export async function GET() {
  try {
    const audioDir = path.join(process.cwd(), "public", "audio");

    try {
      await fs.access(audioDir);
    } catch {
      return NextResponse.json({ projects: [] });
    }

    const entries = await fs.readdir(audioDir, { withFileTypes: true });
    const projects: ProjectHistoryItem[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectDir = path.join(audioDir, entry.name);
      const timelinePath = path.join(projectDir, "timeline.json");

      try {
        const content = await fs.readFile(timelinePath, "utf8");
        const data = JSON.parse(content);

        // Derive human-readable date from folder name or file creation
        let formattedDate = entry.name.replace("project_", "").replace("_", " ");
        // e.g. 2026-11-10 20-49-48 -> 2026-11-10 20:49:48
        if (formattedDate.includes("-")) {
          const parts = formattedDate.split(" ");
          if (parts[1]) {
            formattedDate = `${parts[0]} ${parts[1].replace(/-/g, ":")}`;
          }
        }

        const previewText =
          data.timeline?.[0]?.text || data.script?.slice(0, 60) || "Noir Cut";

        projects.push({
          projectId: entry.name,
          formattedDate,
          totalDuration: data.totalDuration || 0,
          segmentsCount: data.segmentsCount || data.timeline?.length || 0,
          previewText,
          script: data.script,
          masterAudioUrl: `/audio/${entry.name}/master.mp3`,
          timelineUrl: `/audio/${entry.name}/timeline.json`,
          subtitlesUrl: `/audio/${entry.name}/subtitles.srt`,
          timeline: data.timeline || [],
        });
      } catch {
        // Skip directories without valid timeline.json
      }
    }

    // Sort descending by folder name / date (newest first)
    projects.sort((a, b) => b.projectId.localeCompare(a.projectId));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to read project history:", error);
    return NextResponse.json(
      { error: "Failed to load project history." },
      { status: 500 }
    );
  }
}

