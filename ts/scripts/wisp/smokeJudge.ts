import { actionFor } from "../../src/game/input/keyBindings";
import { type MatchReplayResult, replayMatch } from "../../src/game/replay/matchReplay";
import type { ReplayState } from "../../src/game/replay/snapshot";
import type { AttackStyle } from "../../src/game/sim/codes";
import { traitMove } from "../../src/game/sim/identityTraits";
import { normalName } from "../../src/game/sim/moveNames";
import { fighterName } from "../../src/game/sim/heroes/registry";
import { fighterAt, isActive } from "../../src/game/sim/roster";
import type { MapStall } from "./mapStalls";
import { FRAME_MILLIS, type MoveClass, SMOKE_BINDINGS, type SmokeStep, type SmokeTape, bindingSweep, keyName, tapeFrames } from "./smokeTape";

export const STEP_SLACK = 24;
export const FREEZE_FRAMES = STEP_SLACK;
export const PACE_GAP_FRAMES = 3;

export type SmokePlan = SmokeTape;

export interface StepResult {
  readonly slot: number;
  readonly fighter: string;
  readonly step: string;
  readonly kind: "binding" | "move" | "setup";
  readonly pass: boolean;
  readonly reason: string;
  readonly lost?: number;
  readonly stalled?: MapStall;
}

export interface FrozenStep {
  readonly slot: number;
  readonly step: string;
  readonly lost: number;
}

export interface SmokeVerdict {
  readonly replay: MatchReplayResult;
  readonly results: readonly StepResult[];
  readonly frozen: readonly FrozenStep[];
}

interface Start {
  readonly frame: number;
  readonly label: string;
  readonly style?: AttackStyle;
  readonly special?: string;
}

interface SlotTrace {
  fighter: string;
  readonly held: number[];
  readonly state: string[];
  readonly starts: Start[];
  serial: number | undefined;
  action: number;
}

const newTrace = (): SlotTrace => ({ fighter: "", held: [], state: [], starts: [], serial: undefined, action: 0 });

const firstPressMask = (step: SmokeStep): number => {
  const first = step.presses.find((press) => press.at === 0) ?? step.presses[0];
  let mask = 0;
  for (const pressed of first?.keys ?? []) {
    const action = actionFor(SMOKE_BINDINGS, pressed);
    if (action !== undefined) mask |= 1 << action;
  }
  return mask;
};

const matches = (expect: MoveClass, start: Start): boolean =>
  expect.kind === "attack" ? start.style !== undefined && expect.styles.includes(start.style) : start.special === expect.move;

function traceFrame(trace: SlotTrace, state: Readonly<ReplayState>, slot: number, frame: number, held: number): void {
  const f = fighterAt(state.world, slot);
  trace.fighter = fighterName(f.character);
  trace.held[frame] = held;
  trace.state[frame] = `phase ${state.match.phase}${state.match.training ? " training" : ""} x ${Math.round(f.motion.x)} z ${Math.round(f.motion.z)}${f.motion.grounded ? "" : " airborne"} stocks ${f.status.stocks}${f.launch.hitstun > 0 ? " hitstun" : ""} special ${f.special.action} mana ${f.mana.points}`;
  if (trace.serial !== undefined && f.attack.serial !== trace.serial && f.attack.style !== undefined) trace.starts.push({ frame, label: normalName(f.attack.style), style: f.attack.style });
  trace.serial = f.attack.serial;
  if (f.special.action === trace.action) return;
  const move = traitMove(f.special.action as Parameters<typeof traitMove>[0]);
  if (move !== undefined) trace.starts.push({ frame, label: `${move} special`, special: move });
  trace.action = f.special.action;
}

function anchorOf(trace: SlotTrace, mask: number, low: number, high: number): number | undefined {
  for (let frame = low; frame <= high && frame < trace.held.length; frame++) {
    if (mask !== 0 && ((trace.held[frame] ?? 0) & mask) === mask && ((trace.held[frame - 1] ?? 0) & mask) !== mask) return frame;
  }
  return undefined;
}

function stepResult(slot: number, trace: SlotTrace, step: SmokeStep, anchor: number | undefined, at: number, expected: number | undefined): StepResult | undefined {
  const result = (name: string, kind: StepResult["kind"], pass: boolean, reason: string): StepResult => ({ slot, fighter: trace.fighter, step: name, kind, pass, reason });
  if (step.binding !== undefined) {
    const name = keyName(step.binding);
    return result(`key ${name}`, "binding", anchor !== undefined, anchor === undefined ? `dead binding: no ${name} press reached the game near frame ${expected ?? "start"}` : `frame ${anchor}`);
  }
  const expect = step.expect;
  if (expect === undefined) return undefined;
  const window = trace.starts.filter((start) => start.frame >= at && start.frame < at + step.frames);
  const hit = window.find((start) => matches(expect, start));
  if (hit !== undefined) return result(step.name, "move", true, `frame ${hit.frame}`);
  const state = trace.state[at] ?? "no state";
  return result(step.name, "move", false, anchor === undefined ? "its keys never reached the game" : window.length === 0 ? `nothing started (${state})` : `started ${window.map((start) => start.label).join(", ")} (${state})`);
}

const swallowedBy = (stalls: readonly MapStall[], step: SmokeStep, at: number): MapStall | undefined =>
  stalls.find((stall) => step.presses.some((press) => at + press.at <= stall.through && at + press.at + press.hold >= stall.from && stall.millis >= press.hold * FRAME_MILLIS));

export function judgeSmoke(lines: readonly string[], plans: readonly SmokePlan[], stalls: readonly (readonly MapStall[])[] = []): SmokeVerdict {
  const traces = new Map<number, SlotTrace>([...new Set(plans.map(({ slot }) => slot))].map((slot) => [slot, newTrace()]));
  let hazards: boolean | undefined;
  const replay = replayMatch(lines, (state, frame, rows) => {
    hazards ??= state.match.hazards;
    for (const [slot, trace] of traces) if (isActive(state.world, slot)) traceFrame(trace, state, slot, frame, rows.rows[slot]?.held ?? 0);
  });
  const results: StepResult[] = [{ slot: 0, fighter: "match", step: "stage hazards off", kind: "setup", pass: hazards === false, reason: hazards === false ? "off" : "stage hazards were on, so a hazard can interrupt any move" }];
  const frozen: FrozenStep[] = [];
  const cursors = new Map<number, number>();
  const carried = new Map<number, number>();
  for (const { slot, steps } of plans) {
    const trace = traces.get(slot);
    if (trace === undefined) continue;
    const from = cursors.get(slot) ?? 1;
    const anchors: (number | undefined)[] = [];
    const expectations: (number | undefined)[] = [];
    const ats: number[] = [];
    let expected: number | undefined;
    let previous = from - 1;
    for (const step of steps) {
      const anchor = anchorOf(trace, firstPressMask(step), Math.max(from, previous + 1), expected === undefined ? trace.held.length : expected + STEP_SLACK);
      const at = anchor ?? expected ?? from;
      anchors.push(anchor);
      expectations.push(expected);
      ats.push(at);
      expected = at + step.frames;
      previous = at;
    }
    let carry = carried.get(slot) ?? 0;
    let judged = false;
    steps.forEach((step, index) => {
      const at = ats[index] ?? from;
      const next = anchors[index + 1];
      const own = next === undefined ? 0 : Math.max(0, at + step.frames - next);
      if (own > FREEZE_FRAMES) frozen.push({ slot, step: step.name, lost: own });
      const result = stepResult(slot, trace, step, anchors[index], at, expectations[index]);
      if (result === undefined) {
        carry += own;
        return;
      }
      judged = true;
      const lost = carry + own;
      carry = 0;
      const stalled = result.pass ? undefined : swallowedBy(stalls[slot] ?? [], step, at);
      if (!result.pass && lost > FREEZE_FRAMES) results.push({ ...result, lost, reason: `${result.reason}, while the client froze and lost ${lost} frames` });
      else if (stalled !== undefined) results.push({ ...result, stalled, reason: `${result.reason}, while the map stalled ${Math.round(stalled.millis)} ms over frames ${stalled.from}-${stalled.through}` });
      else results.push(result);
    });
    carried.set(slot, judged ? 0 : carry);
    cursors.set(slot, Math.max(from, (expected ?? from) - STEP_SLACK));
  }
  return { replay, results, frozen };
}

const disturbance = ({ lost, stalled }: StepResult): string | undefined => lost !== undefined ? `lost ${lost} frames` : stalled === undefined ? undefined : `stalled ${Math.round(stalled.millis)} ms`;

export function disturbedSteps({ results, frozen }: SmokeVerdict, spotFailures: readonly string[] = []): string[] {
  const moves = results.flatMap((result) => {
    const why = disturbance(result);
    return result.pass || why === undefined ? [] : [`P${result.slot + 1} ${result.fighter} ${result.step} ${why}`];
  });
  const spots = spotFailures.flatMap((step) => frozen.filter((freeze) => freeze.step === step).map(({ slot, lost }) => `${step} spot lost ${lost} frames on P${slot + 1}`));
  return [...moves, ...spots];
}

export function smokeReceipt({ replay, results }: SmokeVerdict, fighters: number): string {
  const moves = results.filter(({ kind }) => kind === "move");
  const keys = results.filter(({ kind }) => kind === "binding");
  const replayed = replay.problems.length === 0 && replay.reached === replay.recorded;
  const pass = replayed && results.every(({ pass }) => pass) && moves.length > 0 && keys.length > 0;
  return `SMASHCRAFT GATE moves fighters=${fighters} moves=${moves.length} started=${moves.filter(({ pass }) => pass).length} keys=${keys.length} live=${keys.filter(({ pass }) => pass).length} replayed=${replayed ? 1 : 0} pass=${pass ? 1 : 0}`;
}

export const smokeLines = ({ replay, results }: SmokeVerdict): string[] => [
  ...replay.problems.map((problem) => `replay: ${problem}`),
  ...results.map(({ slot, fighter, step, pass, reason }) => `${pass ? "PASS" : "FAIL"} P${slot + 1} ${fighter} ${step}: ${reason}`),
];

export const mergeVerdicts = (verdicts: readonly SmokeVerdict[]): SmokeVerdict => ({
  replay: verdicts.reduce<MatchReplayResult>((sum, { replay }) => ({ ...sum, frames: sum.frames + replay.frames, problems: [...sum.problems, ...replay.problems], reached: sum.reached + replay.reached, recorded: sum.recorded + replay.recorded }), { checksum: "", frames: 0, problems: [], reached: 0, recorded: 0, digests: 0, divergent: 0 }),
  results: verdicts.flatMap(({ results }) => results),
  frozen: verdicts.flatMap(({ frozen }) => frozen),
});

export function smokePace(lines: readonly string[], { results, frozen }: Pick<SmokeVerdict, "results" | "frozen">, sweep: readonly SmokeStep[] = bindingSweep()): number | undefined {
  if (frozen.length > 0 || results.some(({ kind, pass }) => kind === "binding" && !pass)) return undefined;
  const rises: number[] = [];
  let previous = 0;
  replayMatch(lines, (_state, frame, rows) => {
    const held = rows.rows[0]?.held ?? 0;
    if (held !== 0 && previous === 0) rises.push(frame);
    previous = held;
  });
  const first = rises[0];
  const last = rises[sweep.length - 1];
  const tape = tapeFrames(sweep.slice(0, -1));
  if (first === undefined || last === undefined || tape === 0) return undefined;
  const pace = (last - first) / tape;
  const steady = sweep.slice(0, -1).every((step, index) => Math.abs((rises[index + 1] ?? 0) - (rises[index] ?? 0) - step.frames * pace) <= PACE_GAP_FRAMES);
  return steady ? pace : undefined;
}

export const SMOKE_TABLE_HEADER = "fighter\tkind\tstep\tresult\treason";

export const smokeTable = ({ replay, results, frozen }: SmokeVerdict): string => `${[
  SMOKE_TABLE_HEADER,
  ...replay.problems.map((problem) => `match\treplay\treplay\tFAIL\t${problem}`),
  ...(replay.reached === replay.recorded ? [] : [`match\treplay\tchecksums\tFAIL\treached ${replay.reached} of ${replay.recorded}`]),
  ...results.map(({ fighter, kind, step, pass, reason }) => `${fighter}\t${kind}\t${step}\t${pass ? "PASS" : "FAIL"}\t${reason}`),
  ...frozen.map(({ slot, step, lost }) => `P${slot + 1}\tfreeze\t${step}\tINVALID\tthe client lost ${lost} frames`),
].join("\n")}\n`;
