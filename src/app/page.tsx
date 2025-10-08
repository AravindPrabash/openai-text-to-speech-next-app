"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const VOICES = [
  { value: "alloy", label: "Alloy" },
  { value: "verse", label: "Verse" },
  { value: "soft", label: "Soft" },
];

export default function Home() {
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.load();
      audioRef.current
        .play()
        .catch(() => {
          /* autoplay might fail if user hasn't interacted yet */
        });
    }
  }, [audioUrl]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!script.trim()) {
      setError("Please enter a short CuriousKid Science script.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script, voice }),
      });

      if (!response.ok) {
        const { error: serverError } = await response.json();
        throw new Error(serverError || "Failed to generate voiceover.");
      }

      const data: { url: string } = await response.json();
      setAudioUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-amber-100 to-orange-200 flex items-center justify-center p-6">
      <main className="w-full max-w-3xl bg-white/90 backdrop-blur rounded-3xl shadow-xl border border-orange-200 overflow-hidden">
        <div className="bg-gradient-to-r from-sky-500 via-orange-400 to-amber-400 text-white px-8 py-6">
          <h1 className="text-3xl font-black tracking-tight">
            TTS Voice Lab
          </h1>
          <p className="mt-2 text-sm md:text-base">
            Paste your script, pick a voice, and get a playful MP3 narration for your next episode.
          </p>
        </div>

        <form className="p-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block font-semibold text-sky-700" htmlFor="script">
              Script (8 – 20 seconds)
            </label>
            <textarea
              id="script"
              name="script"
              className="w-full min-h-[9rem] rounded-2xl border-2 border-sky-200 focus:border-orange-400 focus:ring-4 focus:ring-orange-200/70 transition-colors p-4 text-slate-700 placeholder:text-slate-400"
              placeholder="Hey CuriousKids! Today we're exploring why the ocean is salty..."
              value={script}
              onChange={(event) => setScript(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="block font-semibold text-sky-700" htmlFor="voice">
              Choose a voice
            </label>
            <select
              id="voice"
              name="voice"
              className="w-full rounded-2xl border-2 border-sky-200 bg-white p-3 text-slate-700 focus:border-orange-400 focus:ring-4 focus:ring-orange-200/70 transition-colors"
              value={voice}
              onChange={(event) => setVoice(event.target.value)}
            >
              {VOICES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600 bg-red-100/70 border border-red-200 rounded-xl p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 rounded-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 transition-colors text-white font-semibold py-3 text-lg shadow-lg shadow-orange-200 disabled:cursor-not-allowed disabled:bg-orange-300"
            disabled={isLoading}
          >
            {isLoading && (
              <span className="inline-flex h-5 w-5 items-center justify-center">
                <span className="h-5 w-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
              </span>
            )}
            {isLoading ? "Generating..." : "Generate Voice"}
          </button>
        </form>

        {audioUrl && (
          <div className="px-8 pb-8">
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-6 flex flex-col gap-4">
              <h2 className="text-xl font-bold text-sky-800">Your AI Voiceover</h2>
              <audio
                ref={audioRef}
                controls
                className="w-full h-12"
                key={audioUrl}
              >
                <source src={audioUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
              <a
                href={audioUrl}
                download
                className="self-start inline-flex items-center gap-2 rounded-full bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold px-4 py-2 transition-colors shadow focus:outline-none focus:ring-4 focus:ring-sky-300"
              >
                Download MP3
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
