import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { type MatchFrameInput, copyMatchFrameInput, createMatchFrameInput, executeMatchFrame } from "../../game/match/frameInput";
import { type ReplayState, captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../../game/replay/snapshot";
import type { ShellState } from "./state";

/** The last `depth` frames' inputs and the state before them, so each frame can resimulate them as a rollback match at `depth` frames of delay does. */
export interface ForcedReplay {
  readonly depth: number;
  readonly after: readonly ReplayState[];
  readonly inputs: readonly MatchFrameInput[];
  last: number;
  kept: number;
}

export function createForcedReplay(depth: number): ForcedReplay {
  const after: ReplayState[] = [], inputs: MatchFrameInput[] = [];
  for (let index = 0; index <= depth; index++) {
    after.push(createReplaySnapshot());
    inputs.push(createMatchFrameInput());
  }
  return { depth, after, inputs, last: -1, kept: 0 };
}

/** Keeps the frame `s` just ran, then restores the state `depth` frames back and runs those frames again from their kept inputs; gives the frames run again, zero until `depth` frames in a row are kept, and -1 when one would not run. */
export function replayLatest(replay: ForcedReplay, s: ShellState): number {
  const frame = s.runtime.simulationFrame;
  if (replay.depth < 1 || s.frameInput.frame !== frame || frame <= replay.last) return 0;
  replay.kept = frame === replay.last + 1 ? replay.kept + 1 : 1;
  replay.last = frame;
  const size = replay.after.length;
  captureReplaySnapshot(at(replay.after, floorMod(frame, size)), s.world, s.game, s.controls, s.runtime);
  copyMatchFrameInput(at(replay.inputs, floorMod(frame, size)), s.frameInput);
  if (replay.kept <= replay.depth) return 0;
  const from = frame - replay.depth;
  restoreReplaySnapshot(at(replay.after, floorMod(from, size)), s.world, s.game, s.controls, s.runtime);
  for (let next = from + 1; next <= frame; next++) {
    if (!executeMatchFrame(at(replay.inputs, floorMod(next, size)), s.game, s.world, s.controls, s.runtime, next)) return -1;
  }
  return replay.depth;
}
