import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { Action, bit } from "../input/actions";
import { type InputRow, emptyInput, inputRow } from "../input/inputRow";
import { PARTICIPANT_SLOTS, type Slots, participantActive } from "../input/participants";
import { settleNextObservation } from "../match/botPerception";
import { captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { Phase } from "../lobby/lobbyState";
import {
  type MatchReplayRecorder, beginMatchReplayFrame, continueMatchReplay, createMatchReplayRecorder, endMatchReplaySegment, finishMatchReplay, joinReplay,
  matchReplayDone, matchReplayFrameRan, observationsNeededFrom, parseReplayHeader, parseReplayPart, replayManifestLines, replayMatch,
  replayPartLines, takeMatchReplayPart,
} from "./matchReplay";
import { beginMomentFrame, createMomentRecorder, keepMomentEnd, momentFrameRan, recordMomentRow } from "./moment";
import { createTapeWorld } from "./tapeWorld";

declare const debug: {
  readonly gethook: (this: void) => unknown;
  readonly sethook: (this: void, hook?: (this: void) => void, mask?: string, count?: number) => void;
} | undefined;

const SERIAL = 11;
const FRAMES = 480;
const COUNT_STEP = 100;
const RUNNER_STEP = 1000;
const SETTLE_EVERY_SAMPLE = -1000000;

function humanRow(frame: number): InputRow {
  const direction = bit(floorMod(floorDiv(frame, 50), 2) === 0 ? Action.moveRight : Action.moveLeft);
  const tap = (floorMod(frame, 29) === 0 ? bit(Action.attack) : 0) | (floorMod(frame, 47) === 0 ? bit(Action.jump) : 0);
  const row = inputRow({ held: direction, pressed: tap, released: tap, axisX: direction === bit(Action.moveRight) ? 127 : -127 });
  if (row === undefined) throw new Error("observation settle: a scripted row out of range");
  return row;
}

interface InstructionMeter {
  start(): void;
  stop(): number;
}

function instructionMeter(): InstructionMeter | undefined {
  if (typeof debug !== "object") return undefined;
  const hooks = debug;
  let counted = 0;
  let saved: unknown[] = [];
  const forward = () => {
    counted++;
    const runner = saved[0];
    if (typeof runner === "function" && floorMod(counted, RUNNER_STEP / COUNT_STEP) === 0) runner();
  };
  return {
    start: () => {
      saved = [hooks.gethook()];
      hooks.sethook(forward, "", COUNT_STEP);
    },
    stop: () => {
      const runner = saved[0];
      if (typeof runner === "function") hooks.sethook(runner as (this: void) => void, typeof saved[1] === "string" ? saved[1] : "", typeof saved[2] === "number" ? saved[2] : RUNNER_STEP);
      else hooks.sethook();
      const used = counted * COUNT_STEP;
      counted = 0;
      return used;
    },
  };
}

interface RecordedService {
  readonly instructionsPerCallback: number;
  readonly evicted: number;
  readonly neverSettled: number;
  readonly problems: string;
  readonly frames: number;
  readonly reached: number;
  readonly recorded: number;
}

function recordComputerMatch(firstFrame: (recorder: Readonly<MatchReplayRecorder>) => number): RecordedService {
  const tape = createTapeWorld({ stocks: 3, humans: 1 });
  const { world, match, controls, runtime } = tape.live;
  match.computerMask = 2;
  const moment = createMomentRecorder();
  const recorder = createMatchReplayRecorder();
  const frameInput = createMatchFrameInput();
  const rows: Slots<InputRow> = [emptyInput(), emptyInput(), emptyInput(), emptyInput()];
  const parts: (readonly string[])[] = [];
  const settled = new Map<number, boolean>();
  const meter = instructionMeter();
  let serviceInstructions = 0;
  let services = 0;
  const service = (all: boolean) => {
    meter?.start();
    settleNextObservation(runtime.botMemory, firstFrame(recorder));
    continueMatchReplay(recorder);
    serviceInstructions += meter?.stop() ?? 0;
    services++;
    const part = takeMatchReplayPart(recorder, all);
    if (part !== undefined) parts.push(replayPartLines(SERIAL, recorder.parts, part));
    for (const sample of runtime.botMemory.history) settled.set(sample.frame, sample.checksumFirst >= 0);
  };
  for (let frame = 1; frame <= FRAMES; frame++) {
    for (const slot of PARTICIPANT_SLOTS) rows[slot] = participantActive(match.humanMask, slot) ? humanRow(frame) : emptyInput();
    assertTrue(captureNetworkFrame(frameInput, frame, rows, world, match.humanMask));
    beginMatchReplayFrame(recorder, moment, frame, { kind: "network" }, world, match, controls, runtime);
    beginMomentFrame(moment, frame, world, match, controls, runtime);
    assertTrue(executeMatchFrame(frameInput, match, world, controls, runtime, frame));
    for (const slot of PARTICIPANT_SLOTS) if (participantActive(match.humanMask, slot)) recordMomentRow(moment, frame, slot, rows[slot]);
    momentFrameRan(moment, frame);
    matchReplayFrameRan(recorder, moment, frame, world, match, controls, runtime, true);
    service(false);
  }
  const instructionsPerCallback = serviceInstructions / services;
  const oldest = runtime.botMemory.history[0]?.frame ?? FRAMES;
  let evicted = 0;
  let neverSettled = 0;
  settled.forEach((done, frame) => {
    if (frame >= oldest) return;
    evicted++;
    if (!done) neverSettled++;
  });
  keepMomentEnd(moment, world, match, controls, runtime);
  endMatchReplaySegment(recorder, moment, world, match, controls, runtime);
  match.phase = Phase.result;
  while (!matchReplayDone(recorder, match)) service(false);
  const end = finishMatchReplay(recorder, moment, world, match, controls, runtime);
  if (end === undefined) throw new Error("observation settle: the recorder kept nothing");
  service(true);
  const manifest = replayManifestLines({ build: "test", version: "development", serial: SERIAL, frame: end.frame, checksum: end.checksum, parts: recorder.parts });
  const header = parseReplayHeader(manifest);
  if (typeof header === "string") throw new Error(header);
  const bodies = parts.map((part, index) => {
    const parsed = parseReplayPart(part, SERIAL, index + 1);
    if (typeof parsed === "string") throw new Error(parsed);
    return parsed;
  });
  const result = replayMatch(joinReplay(header, bodies));
  return { instructionsPerCallback, evicted, neverSettled, problems: result.problems.join("; "), frames: result.frames, reached: result.reached, recorded: result.recorded };
}

test("replay service: a computer match settles only the observations its next checkpoint folds, replays to every checkpoint, and in Lua32 costs under 92% of settling every sample [k3 measure #168]", () => {
  const needed = recordComputerMatch(observationsNeededFrom);
  const every = recordComputerMatch(() => SETTLE_EVERY_SAMPLE);
  for (const run of [needed, every]) {
    assertEquals(run.problems, "");
    assertEquals(run.frames, FRAMES);
    assertEquals(run.reached, run.recorded);
    assertGreaterThan(run.recorded, 3);
    assertGreaterThan(run.evicted, 300);
  }
  assertGreaterThan(needed.neverSettled * 3, needed.evicted);
  assertEquals(every.neverSettled, 0);
  if (typeof debug === "object") assertLessThan(needed.instructionsPerCallback * 100, every.instructionsPerCallback * 92);
});
