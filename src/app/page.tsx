"use client";

import { FormEvent, useRef, useState } from "react";
import { CHARACTERS, DEFAULT_SCRIPT, CharacterKey } from "@/config/characters";

interface TimelineEntry {
  index: number;
  speaker: CharacterKey;
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
  pauseAfterMs: number;
  stemUrl: string;
}

interface GenerationResult {
  success: boolean;
  projectId: string;
  totalDuration: number;
  masterAudioUrl: string;
  timelineUrl: string;
  subtitlesUrl: string;
  timeline: TimelineEntry[];
}

export default function Home() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [activeStemUrl, setActiveStemUrl] = useState<string | null>(null);

  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const stemAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!script.trim()) {
      setError("Please input a script before generating.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate dialogue stems.");
      }

      setResult(data);
      setActiveStemUrl(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  };

  const playStem = (url: string) => {
    setActiveStemUrl(url);
    if (stemAudioRef.current) {
      stemAudioRef.current.src = url;
      stemAudioRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30">
      {/* Hidden stem audio element */}
      <audio ref={stemAudioRef} className="hidden" />

      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur sticky top-0 z-20 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center font-black tracking-wider text-amber-400 shadow-inner">
            AW
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              Anatomy of a Trap <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-normal">Voiceover Studio</span>
            </h1>
            <p className="text-xs text-zinc-400">
              Multi-speaker noir dialogue pipeline powered by Gemini Audio
            </p>
          </div>
        </div>

        {/* Character badges */}
        <div className="flex items-center gap-2 text-xs">
          {Object.entries(CHARACTERS).map(([key, char]) => (
            <div
              key={key}
              className={`px-2.5 py-1 rounded-md border text-xs font-mono font-medium flex items-center gap-1.5 ${char.color.badge}`}
            >
              <span className="font-bold">{key}:</span>
              <span className="text-[11px] opacity-80">{char.voiceName}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Main Studio Viewport */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Left Column: Script Editor & Controls (5 Cols) */}
        <section className="lg:col-span-5 border-r border-zinc-800/80 p-6 flex flex-col gap-5 bg-zinc-950/40">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="script-input"
                className="text-xs font-semibold uppercase tracking-wider text-zinc-400"
              >
                Noir Script (Dialogue & Micro-Pauses)
              </label>
              <span className="text-[11px] text-zinc-500 font-mono">
                Supports [pause: 450ms]
              </span>
            </div>
            <textarea
              id="script-input"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={16}
              disabled={isGenerating}
              className="w-full bg-[#0d0f14] border border-zinc-800 rounded-xl p-4 font-mono text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition resize-none selection:bg-amber-600/30"
              placeholder="CORVUS: The lock wasn't picked... [pause: 450ms]&#10;BARNABY: Wait, what does that mean?"
            />
          </div>

          {/* Quick Syntax Cheat Sheet */}
          <div className="bg-zinc-900/60 border border-zinc-800/70 rounded-xl p-3.5 text-xs text-zinc-400 space-y-1.5 font-mono">
            <div className="font-sans font-semibold text-zinc-300 mb-1">
              Script Syntax & Persona Cues
            </div>
            <div>
              <span className="text-zinc-200 font-bold">CORVUS:</span> Gritty, low-register investigator baritone (Charon).
            </div>
            <div>
              <span className="text-amber-300 font-bold">BARNABY:</span> Eager, naive, breathless sidekick foil (Puck).
            </div>
            <div>
              <span className="text-cyan-300 font-bold">NARRATOR:</span> Measured documentary case voiceover (Fenrir).
            </div>
            <div>
              <span className="text-zinc-300 font-bold">[pause: Xms]:</span> Injects surgical millisecond dramatic silence.
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 font-mono">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {/* Action button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3.5 px-5 rounded-xl font-semibold text-sm tracking-wide bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:from-amber-700 active:to-amber-800 text-zinc-950 font-sans shadow-lg shadow-amber-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-zinc-950"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Synthesizing Stems & Stitching Master...
              </>
            ) : (
              "Generate Dialogue Stems & Master Track"
            )}
          </button>
        </section>

        {/* Right Column: Timeline, Stem Player & Exports (7 Cols) */}
        <section className="lg:col-span-7 p-6 flex flex-col gap-6 overflow-y-auto">
          {result ? (
            <>
              {/* Master Audio Track Card */}
              <div className="bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-400">
                      Master Track Mix
                    </span>
                    <h2 className="text-base font-bold text-zinc-100">
                      Full Noir Cut ({result.totalDuration.toFixed(2)}s)
                    </h2>
                  </div>
                  {/* Export Buttons */}
                  <div className="flex items-center gap-2">
                    <a
                      href={result.masterAudioUrl}
                      download={`master-${result.projectId}.mp3`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition"
                    >
                      Master MP3
                    </a>
                    <a
                      href={result.timelineUrl}
                      download={`timeline-${result.projectId}.json`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition"
                    >
                      Timeline (.json)
                    </a>
                    <a
                      href={result.subtitlesUrl}
                      download={`subtitles-${result.projectId}.srt`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition"
                    >
                      Subtitles (.srt)
                    </a>
                  </div>
                </div>

                <audio
                  ref={masterAudioRef}
                  controls
                  className="w-full accent-amber-500 rounded-lg"
                  src={result.masterAudioUrl}
                >
                  Your browser does not support audio playback.
                </audio>
              </div>

              {/* Stems & Timeline Manifest */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Dialogue Stem Manifest ({result.timeline.length} Cuts)
                  </h3>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Locked to video sync boundaries
                  </span>
                </div>

                <div className="space-y-2.5">
                  {result.timeline.map((entry) => {
                    const char = CHARACTERS[entry.speaker] || CHARACTERS.NARRATOR;
                    const isPlayingThis = activeStemUrl === entry.stemUrl;

                    return (
                      <div
                        key={entry.index}
                        className={`p-4 rounded-xl border bg-zinc-900/40 hover:bg-zinc-900/80 transition ${
                          isPlayingThis
                            ? "border-amber-500/80 bg-zinc-900/90 shadow-md shadow-amber-950/20"
                            : "border-zinc-800/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-zinc-500 font-medium">
                              #{String(entry.index).padStart(2, "0")}
                            </span>
                            <span
                              className={`text-[11px] font-mono px-2 py-0.5 rounded border font-semibold ${char.color.badge}`}
                            >
                              {entry.speaker}
                            </span>
                            <span className="text-xs text-zinc-400 font-mono">
                              {entry.startTime.toFixed(2)}s – {entry.endTime.toFixed(2)}s
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              {entry.duration.toFixed(2)}s duration
                            </span>
                            {entry.pauseAfterMs > 0 && (
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/50 border border-amber-800/50 text-amber-300">
                                +{entry.pauseAfterMs}ms pause
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-zinc-200 font-serif leading-relaxed mb-3 italic">
                          &ldquo;{entry.text}&rdquo;
                        </p>

                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-800/60">
                          <button
                            onClick={() => playStem(entry.stemUrl)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 cursor-pointer"
                          >
                            <svg
                              className="w-4 h-4 fill-current"
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            {isPlayingThis ? "Playing Stem..." : "Preview Line"}
                          </button>

                          <a
                            href={entry.stemUrl}
                            download={`${String(entry.index).padStart(2, "0")}_${entry.speaker.toLowerCase()}.wav`}
                            className="text-xs text-zinc-400 hover:text-zinc-200 font-mono underline underline-offset-4"
                          >
                            Download Stem (.wav)
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full min-h-[360px] flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
              <div className="h-12 w-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
                <svg
                  className="w-6 h-6 stroke-current"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-1">
                No Dialogue Generated Yet
              </h3>
              <p className="text-xs max-w-sm text-zinc-500">
                Hit &ldquo;Generate Dialogue Stems & Master Track&rdquo; on the left to synthesize individual character lines, compute millisecond video syncs, and stitch the master audio.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
