import { NextResponse } from "next/server";
import OpenAI from "openai";
import path from "path";
import { promises as fs } from "fs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const runtime = "nodejs";

interface TTSRequestBody {
  text?: string;
  voice?: string;
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OpenAI API key." }, { status: 500 });
  }

  try {
    const { text, voice }: TTSRequestBody = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: voice || "alloy",
      input: text,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const audioDir = path.join(process.cwd(), "public", "audio");
    const fileName = `tts-${Date.now()}.mp3`;
    const filePath = path.join(audioDir, fileName);

    await fs.mkdir(audioDir, { recursive: true });
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({ url: `/audio/${fileName}` });
  } catch (error) {
    console.error("TTS generation failed", error);
    return NextResponse.json({ error: "Failed to generate speech." }, { status: 500 });
  }
}
