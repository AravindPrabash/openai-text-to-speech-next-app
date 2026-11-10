"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  script?: string;
}

interface ProjectHistoryItem {
  projectId: string;
  formattedDate: string;
  totalDuration: number;
  segmentsCount: number;
  previewText: string;
  script?: string;
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

  // History state
  const [history, setHistory] = useState<ProjectHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Audio playback state for individual stems
  const [activeStemUrl, setActiveStemUrl] = useState<string | null>(null);
  const [isStemPlaying, setIsStemPlaying] = useState(false);
  const [stemProgress, setStemProgress] = useState(0);

  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const stemAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load project history on mount (without auto-selecting)
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.projects || []);
      }
    } catch (err) {
      console.warn("Failed to fetch history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync stem audio player events
  useEffect(() => {
    const audio = stemAudioRef.current;
    if (!audio) return;

    const onPlay = () => setIsStemPlaying(true);
    const onPause = () => setIsStemPlaying(false);
    const onEnded = () => {
      setIsStemPlaying(false);
      setStemProgress(0);
      setActiveStemUrl(null);
    };
    const onTimeUpdate = () => {
      if (audio.duration) {
        setStemProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, []);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!script.trim()) {
      setError("Please input a script before generating.");
      return;
    }

    // Stop any active stem playback
    if (stemAudioRef.current) {
      stemAudioRef.current.pause();
    }
    setActiveStemUrl(null);
    setIsStemPlaying(false);

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
      // Refresh history list so the new session shows up immediately
      fetchHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleHistoryItem = (item: ProjectHistoryItem) => {
    stopStem();

    // If clicking the currently selected project, deselect it
    if (result?.projectId === item.projectId) {
      setResult(null);
      if (masterAudioRef.current) {
        masterAudioRef.current.pause();
      }
      return;
    }

    // Otherwise select the clicked project and populate preview
    setResult({
      success: true,
      projectId: item.projectId,
      totalDuration: item.totalDuration,
      masterAudioUrl: item.masterAudioUrl,
      timelineUrl: item.timelineUrl,
      subtitlesUrl: item.subtitlesUrl,
      timeline: item.timeline,
      script: item.script,
    });
    if (item.script) {
      setScript(item.script);
    }
  };

  const toggleStem = (url: string) => {
    if (!stemAudioRef.current) return;

    if (masterAudioRef.current && !masterAudioRef.current.paused) {
      masterAudioRef.current.pause();
    }

    if (activeStemUrl === url) {
      if (isStemPlaying) {
        stemAudioRef.current.pause();
      } else {
        stemAudioRef.current.play().catch(() => {});
      }
    } else {
      setActiveStemUrl(url);
      stemAudioRef.current.src = url;
      stemAudioRef.current.currentTime = 0;
      stemAudioRef.current.play().catch(() => {});
    }
  };

  const stopStem = () => {
    if (stemAudioRef.current) {
      stemAudioRef.current.pause();
      stemAudioRef.current.currentTime = 0;
    }
    setIsStemPlaying(false);
    setActiveStemUrl(null);
    setStemProgress(0);
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30">
      <audio ref={stemAudioRef} className="hidden" preload="auto" />

      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur sticky top-0 z-20 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center font-black tracking-wider text-amber-400 shadow-inner">
            AW
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              Anatomy of a Trap{" "}
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-normal">
                Voiceover Studio
              </span>
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
        {/* Left Column: Script Editor & History (5 Cols) */}
        <section className="lg:col-span-5 border-r border-zinc-800/80 p-6 flex flex-col gap-6 bg-zinc-950/40">
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
              rows={14}
              disabled={isGenerating}
              className="w-full bg-[#0d0f14] border border-zinc-800 rounded-xl p-4 font-mono text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition resize-none selection:bg-amber-600/30"
              placeholder="CORVUS: The lock wasn't picked... [pause: 450ms]&#10;BARNABY: Wait, what does that mean?"
            />
          </div>

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

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 font-mono">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {/* Project History Section */}
          <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <svg
                  className="w-3.5 h-3.5 text-zinc-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Project History ({history.length})
              </h2>
              <button
                onClick={fetchHistory}
                disabled={isLoadingHistory}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                title="Refresh project list"
              >
                {isLoadingHistory ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {history.length > 0 ? (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {history.map((item) => {
                  const isCurrent = result?.projectId === item.projectId;
                  return (
                    <button
                      key={item.projectId}
                      onClick={() => toggleHistoryItem(item)}
                      className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 ${
                        isCurrent
                          ? "bg-zinc-900 border-amber-500/80 shadow-sm shadow-amber-950/30 ring-1 ring-amber-500/30"
                          : "bg-zinc-900/30 border-zinc-800/80 hover:bg-zinc-900/70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-semibold text-zinc-200 flex items-center gap-1.5">
                          {isCurrent && (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                          )}
                          {item.formattedDate}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {item.totalDuration.toFixed(1)}s • {item.segmentsCount} lines
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {isCurrent ? "Deselect" : "View"}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 italic truncate font-serif">
                        &ldquo;{item.previewText}&rdquo;
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-zinc-600 font-mono italic p-3 text-center border border-dashed border-zinc-800 rounded-xl">
                No past projects found.
              </div>
            )}
          </div>
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
                      {result.projectId.replace("project_", "")} ({result.totalDuration.toFixed(2)}s)
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
                  onPlay={() => {
                    stopStem();
                  }}
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
                    const isSelected = activeStemUrl === entry.stemUrl;
                    const isPlaying = isSelected && isStemPlaying;

                    return (
                      <div
                        key={entry.index}
                        className={`p-4 rounded-xl border transition relative overflow-hidden ${
                          isSelected
                            ? "border-amber-500/80 bg-zinc-900/90 shadow-md shadow-amber-950/20"
                            : "border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/70"
                        }`}
                      >
                        {/* Progress Bar for Active Playing Stem */}
                        {isSelected && (
                          <div
                            className="absolute bottom-0 left-0 h-1 bg-amber-500 transition-all duration-100 ease-linear"
                            style={{ width: `${stemProgress}%` }}
                          />
                        )}

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
                              {entry.duration.toFixed(2)}s
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
                          {/* Dedicated Play / Pause / Stop Controls */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleStem(entry.stemUrl)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition ${
                                isPlaying
                                  ? "bg-amber-500 text-zinc-950 font-semibold"
                                  : isSelected
                                  ? "bg-zinc-800 text-amber-400 hover:bg-zinc-700"
                                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white"
                              }`}
                            >
                              {isPlaying ? (
                                <>
                                  <svg
                                    className="w-3.5 h-3.5 fill-current"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                  </svg>
                                  Pause
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="w-3.5 h-3.5 fill-current"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                  {isSelected ? "Resume" : "Preview Line"}
                                </>
                              )}
                            </button>

                            {isSelected && (
                              <button
                                onClick={stopStem}
                                title="Stop and reset stem playback"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 border border-zinc-700/80 cursor-pointer transition"
                              >
                                <svg
                                  className="w-3 h-3 fill-current"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M6 6h12v12H6z" />
                                </svg>
                                Stop
                              </button>
                            )}
                          </div>

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
