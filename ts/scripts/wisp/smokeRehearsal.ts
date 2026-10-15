import type { KeyBindings } from "../../src/game/input/keyBindings";
import { type InputRow, emptyInput } from "../../src/game/input/inputRow";
import { matchSpawnX } from "../../src/game/match/step";
import { joinReplay, parseReplayHeader, parseReplayPart, replayMatch } from "../../src/game/replay/matchReplay";
import { TAPE_REPLAY_SERIAL, recordTapeReplay } from "../../src/game/replay/tapeReplay";
import { Character } from "../../src/game/sim/codes";
import { createFighter } from "../../src/game/sim/fighter";
import { fighterAt } from "../../src/game/sim/roster";
import { type SmokeVerdict, judgeSmoke } from "./smokeJudge";
import { SMOKE_BINDINGS, type SmokeSegment, approachStep, heldMasks, keyboardRows, segmentFrames, smokeSchedule } from "./smokeTape";

const LEAD_FRAMES = 30;
const BETWEEN_FRAMES = 60;
const CONTACT_GAP = 60;
const APPROACH_LIMIT = 240;

function recorded(first: Character, second: Character, frames: number, rows: readonly (readonly InputRow[])[]): string[] {
  const idle = emptyInput();
  const tape = recordTapeReplay(frames, 0, {
    rowAt: (slot, frame) => rows[slot]?.[frame - 1] ?? idle,
    first: createFighter(first, matchSpawnX(0), 1),
    second: createFighter(second, matchSpawnX(1), -1),
    training: true,
  });
  const header = parseReplayHeader(tape.manifest);
  if (typeof header === "string") throw new Error(header);
  return joinReplay(header, tape.parts.map((part, index) => {
    const body = parseReplayPart(part, TAPE_REPLAY_SERIAL, index + 1);
    if (typeof body === "string") throw new Error(body);
    return body;
  }));
}

export function approachFrames(character: Character, slot: number): number {
  const masks = heldMasks([approachStep(slot, APPROACH_LIMIT)], SMOKE_BINDINGS);
  const walking = keyboardRows(masks);
  const fighters: [Character, Character] = slot === 0 ? [character, Character.rifleman] : [Character.rifleman, character];
  let arrived = APPROACH_LIMIT;
  replayMatch(recorded(fighters[0], fighters[1], APPROACH_LIMIT, slot === 0 ? [walking] : [[], walking]), (state, frame) => {
    if (arrived < APPROACH_LIMIT) return;
    const gap = Math.abs(fighterAt(state.world, 0).motion.x - fighterAt(state.world, 1).motion.x);
    if (gap <= CONTACT_GAP) arrived = frame;
  });
  return arrived;
}

export const smokeApproaches = (first: Character, second: Character): [number, number] => [approachFrames(first, 0), approachFrames(second, 1)];

export interface Rehearsal {
  readonly lines: string[];
  readonly starts: number[];
}

export function rehearsal(first: Character, second: Character, bindings: KeyBindings, schedule: readonly SmokeSegment[]): Rehearsal {
  const frames = schedule.reduce((total, segment) => total + segmentFrames(segment) + BETWEEN_FRAMES, LEAD_FRAMES);
  const masks = [new Array<number>(frames).fill(0), new Array<number>(frames).fill(0)];
  let start = LEAD_FRAMES;
  const starts: number[] = [];
  for (const segment of schedule) {
    starts.push(start);
    for (const { slot, steps } of segment) heldMasks(steps, bindings).forEach((held, index) => { const row = masks[slot]; if (row !== undefined) row[start + index] = held; });
    start += segmentFrames(segment) + BETWEEN_FRAMES;
  }
  return { lines: recorded(first, second, frames, masks.map(keyboardRows)), starts };
}

export function rehearseSmoke(first: Character, second: Character, bindings: KeyBindings = SMOKE_BINDINGS, schedule: readonly SmokeSegment[] = smokeSchedule(smokeApproaches(first, second))): SmokeVerdict {
  return judgeSmoke(rehearsal(first, second, bindings, schedule).lines, schedule.flat());
}
