export type CharacterKey = "CORVUS" | "BARNABY" | "NARRATOR";

export interface CharacterProfile {
  name: string;
  role: string;
  voiceName: string; // Gemini prebuilt voice name
  deliveryInstruction: string;
  useAcousticPromptPrimer: boolean; // Priming prompt to induce deep acting register
  audioFilters?: string[];
  color: {
    badge: string;
    border: string;
    text: string;
  };
}

export const CHARACTERS: Record<CharacterKey, CharacterProfile> = {
  CORVUS: {
    name: "Corvus the Raven",
    role: "Cynical Noir Investigator",
    voiceName: "Charon", // The original voice you loved
    deliveryInstruction:
      "A cynical, intelligent noir detective. Low pitch, gravelly, slow and deliberate cadence, unbothered.",
    useAcousticPromptPrimer: true, // Uses acoustic priming to lock in the deep, compact noir baritone
    audioFilters: [
      "equalizer=f=120:width_type=o:w=1.2:g=4", // Adds that warm vintage condenser mic presence
      "volume=1.5dB",
    ],
    color: {
      badge: "bg-zinc-800 text-zinc-100 border-zinc-700",
      border: "border-zinc-700",
      text: "text-zinc-200",
    },
  },
  BARNABY: {
    name: "Barnaby the Basset Hound",
    role: "Eager / Defensive Foil",
    voiceName: "Puck",
    deliveryInstruction:
      "A naive, eager, slightly breathless sidekick trying to justify his mistake. Expressive, warmer tone.",
    useAcousticPromptPrimer: false,
    audioFilters: [
      "equalizer=f=2500:width_type=o:w=1.5:g=2",
      "highpass=f=90",
    ],
    color: {
      badge: "bg-amber-950/70 text-amber-300 border-amber-800/80",
      border: "border-amber-800/50",
      text: "text-amber-200",
    },
  },
  NARRATOR: {
    name: "Narrator",
    role: "Archival Case Documentarian",
    voiceName: "Aoede",
    deliveryInstruction:
      "Measured, objective documentary tone for archival investigative case voiceover. Steady and neutral.",
    useAcousticPromptPrimer: false,
    audioFilters: [
      "highpass=f=80",
      "equalizer=f=3000:width_type=o:w=1.2:g=1.5",
    ],
    color: {
      badge: "bg-cyan-950/70 text-cyan-300 border-cyan-800/80",
      border: "border-cyan-800/50",
      text: "text-cyan-200",
    },
  },
};

export const DEFAULT_SCRIPT = `NARRATOR: Anatomy of a Trap. Case File 104: The Velvet Gallery. [pause: 600ms]
CORVUS: The lock wasn't picked, Barnaby. It was unbolted from the inside. [pause: 450ms]
BARNABY: Wait—from the inside? But the vault sensors didn't trigger until midnight! [pause: 300ms]
CORVUS: Exactly. Someone didn't break in to steal the diamond... [pause: 800ms] they broke out to escape with it. [pause: 500ms]
BARNABY: Holy biscuits, Corvus. We weren't chasing a thief... we were chasing the bait!`;
