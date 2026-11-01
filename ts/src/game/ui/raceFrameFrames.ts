import { type Frame, namedFrame } from "wisp/game/frames";
import type { Race } from "../roster/races";
import { createSmashcraftRaceFrameHuman } from "./raceFrameHumanFrames";
import { createSmashcraftRaceFrameNightElf } from "./raceFrameNightElfFrames";
import { createSmashcraftRaceFrameOrc } from "./raceFrameOrcFrames";
import { createSmashcraftRaceFrameUndead } from "./raceFrameUndeadFrames";

export interface RaceFrameFrames {
  readonly root: Frame;
  readonly portrait: Frame;
}

const CREATE: { readonly [R in Race]: (parent: Frame, context: number) => RaceFrameFrames | undefined } = {
  Human: createSmashcraftRaceFrameHuman,
  NightElf: createSmashcraftRaceFrameNightElf,
  Orc: createSmashcraftRaceFrameOrc,
  Undead: createSmashcraftRaceFrameUndead,
};

// Engine: a SIMPLEFRAME needs a simple parent, and ConsoleUI stays shown when the map hides the origin frames.
export function createRaceFrame(race: Race, context: number): RaceFrameFrames {
  const frames = CREATE[race](namedFrame("ConsoleUI", 0), context);
  if (frames === undefined) throw new Error(`race frame ${race}: its TOC did not load`);
  return frames;
}
