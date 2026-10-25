import type { KeyBindings } from "../../src/game/input/keyBindings";
import { type InputRow, emptyInput } from "../../src/game/input/inputRow";
import { matchSpawnX } from "../../src/game/match/step";
import { joinReplay, parseReplayHeader, parseReplayPart, replayMatch } from "../../src/game/replay/matchReplay";
import { TAPE_REPLAY_SERIAL, recordTapeReplay } from "../../src/game/replay/tapeReplay";
import { Character } from "../../src/game/sim/codes";
import { createFighter } from "../../src/game/sim/fighter";
import { fighterAt } from "../../src/game/sim/roster";
import { type SmokeVerdict, judgeSmoke } from "./smokeJudge";
import { SMOKE_BINDINGS, type SmokeSegment, approachStep, heldMasks, keyboardRows, segmentFrames, smokeSchedule, strikeStep } from "./smokeTape";

const LEAD_FRAMES = 30;
const BETWEEN_FRAMES = 60;
const CONTACT_GAP = 80;
const APPROACH_LIMIT = 240;
const APPROACH_SEARCH = 12;

function recorded(first: Character, second: Character, frames: number, rows: readonly (readonly InputRow[])[], hazards = false): string[] {
  const idle = emptyInput();
  const tape = recordTapeReplay(frames, 0, {
    rowAt: (slot, frame) => rows[slot]?.[frame - 1] ?? idle,
    first: createFighter(first, matchSpawnX(0), 1),
    second: createFighter(second, matchSpawnX(1), -1),
    training: true,
    hazards,
  });
  const header = parseReplayHeader(tape.manifest);
  if (typeof header === "string") throw new Error(header);
  return joinReplay(header, tape.parts.map((part, index) => {
    const body = parseReplayPart(part, TAPE_REPLAY_SERIAL, index + 1);
    if (typeof body === "string") throw new Error(body);
    return body;
  }));
}

function contactFrames(fighters: readonly [Character, Character], walker: number): number {
  const walking = keyboardRows(heldMasks([approachStep(walker, APPROACH_LIMIT)], SMOKE_BINDINGS));
  let arrived = APPROACH_LIMIT;
  replayMatch(recorded(fighters[0], fighters[1], APPROACH_LIMIT, walker === 0 ? [walking] : [[], walking]), (state, frame) => {
    if (arrived < APPROACH_LIMIT) return;
    const gap = Math.abs(fighterAt(state.world, 0).motion.x - fighterAt(state.world, 1).motion.x);
    if (gap <= CONTACT_GAP) arrived = frame;
  });
  return arrived;
}

function strikeLands(fighters: readonly [Character, Character], walker: number, approach: number): boolean {
  const striker = 1 - walker;
  const strike = strikeStep(striker, approach);
  const walking = keyboardRows(heldMasks([approachStep(walker, approach)], SMOKE_BINDINGS));
  const striking = keyboardRows(heldMasks([strike], SMOKE_BINDINGS));
  let landed = false;
  replayMatch(recorded(fighters[0], fighters[1], strike.frames, walker === 0 ? [walking, striking] : [striking, walking]), (state) => {
    landed ||= fighterAt(state.world, striker).mana.points > 0;
  });
  return landed;
}

export function approachFrames(fighters: readonly [Character, Character], walker: number): number {
  const contact = contactFrames(fighters, walker);
  const lands = (approach: number) => approach >= 1 && approach <= APPROACH_LIMIT && strikeLands(fighters, walker, approach);
  const found = Array.from({ length: APPROACH_SEARCH + 1 }, (_, offset) => [contact - offset, contact + offset]).flat().find(lands);
  if (found === undefined) return contact;
  let low = found;
  let high = found;
  while (found - low < APPROACH_SEARCH && lands(low - 1)) low--;
  while (high - found < APPROACH_SEARCH && lands(high + 1)) high++;
  return Math.floor((low + high) / 2);
}

export const smokeApproaches = (first: Character, second: Character): [number, number] => [approachFrames([first, second], 0), approachFrames([first, second], 1)];

export interface TapeSpan {
  readonly segment: number;
  readonly at: number;
  readonly frames: number;
}

export interface RehearsalOptions {
  readonly rate?: number;
  readonly freeze?: TapeSpan;
  readonly stall?: TapeSpan;
  readonly hazards?: boolean;
}

export interface Rehearsal {
  readonly lines: string[];
  readonly starts: number[];
}

export function rehearsal(first: Character, second: Character, bindings: KeyBindings, schedule: readonly SmokeSegment[], { rate = 1, freeze, stall, hazards = false }: RehearsalOptions = {}): Rehearsal {
  const tape = schedule.reduce((total, segment) => total + segmentFrames(segment) + BETWEEN_FRAMES, LEAD_FRAMES);
  const masks = [new Array<number>(tape).fill(0), new Array<number>(tape).fill(0)];
  let start = LEAD_FRAMES;
  const starts: number[] = [];
  for (const segment of schedule) {
    starts.push(start);
    for (const { slot, steps } of segment) heldMasks(steps, bindings).forEach((held, index) => { const row = masks[slot]; if (row !== undefined) row[start + index] = held; });
    start += segmentFrames(segment) + BETWEEN_FRAMES;
  }
  const frozenAt = freeze === undefined ? tape : (starts[freeze.segment] ?? tape) + freeze.at;
  const skipped = freeze?.frames ?? 0;
  const tapeAt = (frame: number) => {
    const played = Math.floor(frame / rate);
    return played < frozenAt ? played : played + skipped;
  };
  const frames = Math.ceil((tape - skipped) * rate);
  const stalledAt = stall === undefined ? frames : Math.round(((starts[stall.segment] ?? tape) + stall.at) * rate);
  const polledAfter = stalledAt + (stall?.frames ?? 0);
  const polledAt = (frame: number) => (frame >= stalledAt && frame < polledAfter ? polledAfter : frame);
  const paced = masks.map((row) => Array.from({ length: frames }, (_, frame) => row[tapeAt(polledAt(frame))] ?? 0));
  return { lines: recorded(first, second, frames, paced.map(keyboardRows), hazards), starts: starts.map((frame) => Math.round(frame * rate)) };
}

export function rehearseSmoke(first: Character, second: Character, bindings: KeyBindings = SMOKE_BINDINGS, schedule: readonly SmokeSegment[] = smokeSchedule(smokeApproaches(first, second)), rate = 1): SmokeVerdict {
  return judgeSmoke(rehearsal(first, second, bindings, schedule, { rate }).lines, schedule.flat());
}
