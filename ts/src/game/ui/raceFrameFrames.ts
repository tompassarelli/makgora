import { type Frame, namedFrame } from "wisp/game/frames";
import type { Race } from "../roster/races";
import { createMakgoraRaceFrameHuman } from "./raceFrameHumanFrames";
import { createMakgoraRaceFrameNightElf } from "./raceFrameNightElfFrames";
import { createMakgoraRaceFrameOrc } from "./raceFrameOrcFrames";
import { createMakgoraRaceFrameUndead } from "./raceFrameUndeadFrames";

export interface RaceFrameFrames {
  readonly root: Frame;
  readonly portrait: Frame;
}

const CREATE: { readonly [R in Race]: (parent: Frame, context: number) => RaceFrameFrames | undefined } = {
  Human: createMakgoraRaceFrameHuman,
  NightElf: createMakgoraRaceFrameNightElf,
  Orc: createMakgoraRaceFrameOrc,
  Undead: createMakgoraRaceFrameUndead,
};

// Engine: a SIMPLEFRAME needs a simple parent, and ConsoleUI stays shown when the map hides the origin frames.
export function createRaceFrame(race: Race, context: number): RaceFrameFrames {
  const frames = CREATE[race](namedFrame("ConsoleUI", 0), context);
  if (frames === undefined) throw new Error(`race frame ${race}: its TOC did not load`);
  return frames;
}
