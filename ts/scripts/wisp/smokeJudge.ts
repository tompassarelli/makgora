import { actionFor } from "../../src/game/input/keyBindings";
import { type MatchReplayResult, replayMatch } from "../../src/game/replay/matchReplay";
import type { ReplayState } from "../../src/game/replay/snapshot";
import type { AttackStyle } from "../../src/game/sim/codes";
import { traitMove } from "../../src/game/sim/identityTraits";
import { normalName } from "../../src/game/sim/moveNames";
import { fighterName } from "../../src/game/sim/heroes/registry";
import { fighterAt, isActive } from "../../src/game/sim/roster";
import { type MoveClass, SMOKE_BINDINGS, type SmokeStep, type SmokeTape, keyName } from "./smokeTape";

export const STEP_SLACK = 24;

export type SmokePlan = SmokeTape;

export interface StepResult {
  readonly slot: number;
  readonly fighter: string;
  readonly step: string;
  readonly kind: "binding" | "move" | "setup";
  readonly pass: boolean;
  readonly reason: string;
}

export interface SmokeVerdict {
  readonly replay: MatchReplayResult;
  readonly results: readonly StepResult[];
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

export function judgeSmoke(lines: readonly string[], plans: readonly SmokePlan[]): SmokeVerdict {
  const traces = new Map<number, SlotTrace>([...new Set(plans.map(({ slot }) => slot))].map((slot) => [slot, newTrace()]));
  const replay = replayMatch(lines, (state, frame, rows) => {
    for (const [slot, trace] of traces) if (isActive(state.world, slot)) traceFrame(trace, state, slot, frame, rows.rows[slot]?.held ?? 0);
  });
  const results: StepResult[] = [];
  const cursors = new Map<number, number>();
  for (const { slot, steps } of plans) {
    const trace = traces.get(slot);
    if (trace === undefined) continue;
    const from = cursors.get(slot) ?? 1;
    let expected: number | undefined;
    for (const step of steps) {
      const anchor = expected === undefined ? anchorOf(trace, firstPressMask(step), from, trace.held.length) : anchorOf(trace, firstPressMask(step), Math.max(from, expected - STEP_SLACK), expected + STEP_SLACK);
      const at = anchor ?? expected ?? from;
      const result = stepResult(slot, trace, step, anchor, at, expected);
      if (result !== undefined) results.push(result);
      expected = at + step.frames;
    }
    cursors.set(slot, Math.max(from, (expected ?? from) - STEP_SLACK));
  }
  return { replay, results };
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
});
