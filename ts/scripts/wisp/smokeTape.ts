import { Action } from "../../src/game/input/actions";
import { type KeyBindings, actionFor, keyFor, presetBindings } from "../../src/game/input/keyBindings";
import { type InputRow, copyInput, emptyInput } from "../../src/game/input/inputRow";
import { commitEdges, keyboardCapture, sampleKeys } from "../../src/game/input/keyboardCapture";
import { AttackStyle } from "../../src/game/sim/codes";

export const SMOKE_BINDINGS: KeyBindings = presetBindings("standard");

export type MoveClass =
  | { readonly kind: "attack"; readonly styles: readonly AttackStyle[] }
  | { readonly kind: "special"; readonly move: "neutral" | "side" | "up" | "down" | "ultimate" };

export interface Press {
  readonly at: number;
  readonly keys: readonly number[];
  readonly hold: number;
}

export interface SmokeStep {
  readonly name: string;
  readonly presses: readonly Press[];
  readonly frames: number;
  readonly binding?: number;
  readonly expect?: MoveClass;
}

const key = (action: Action, second = false): number => {
  const bound = keyFor(SMOKE_BINDINGS, action, second ? 1 : 0);
  if (bound === undefined) throw new Error(`the standard preset binds no key to action ${action}`);
  return bound;
};

const attack = (...styles: AttackStyle[]): MoveClass => ({ kind: "attack", styles });
const special = (move: "neutral" | "side" | "up" | "down" | "ultimate"): MoveClass => ({ kind: "special", move });
const tap = (keys: readonly number[], hold = 4): Press => ({ at: 0, keys, hold });

export const RESET_LEAD = 120;
export const DROP_AT = 60;
export const SETTLE_AT = 90;
export const SPECIAL_TAIL = 240;
export const MANA_CYCLES = 20;
export const APPROACH_FRAMES = 100;
export const STRIKES = 3;
export const STRIKE_EVERY = 30;

export interface SmokeTape {
  readonly slot: number;
  readonly steps: readonly SmokeStep[];
}

export type SmokeSegment = readonly SmokeTape[];

const facingOf = (slot: number): 1 | -1 => (slot === 0 ? 1 : -1);

const RESET: Press = { at: 0, keys: [key(Action.leftTrigger), key(Action.rightTrigger), key(Action.attack)], hold: 4 };

function afterReset(name: string, presses: readonly Press[], frames: number, expect?: MoveClass): SmokeStep {
  return { name, presses: [RESET, { at: DROP_AT, keys: [key(Action.moveDown)], hold: 6 }, ...presses.map((press) => ({ ...press, at: press.at + RESET_LEAD }))], frames: frames + RESET_LEAD, ...(expect === undefined ? {} : { expect }) };
}

export const approachStep = (slot: number, frames: number): SmokeStep => ({ name: "approach", presses: [{ at: 0, keys: [key(Action.walk), key(facingOf(slot) > 0 ? Action.moveRight : Action.moveLeft)], hold: frames }], frames });

function charge(slot: number, approaches: readonly [number, number]): SmokeStep[] {
  const smash = key(facingOf(slot) > 0 ? Action.smashRight : Action.smashLeft);
  return Array.from({ length: MANA_CYCLES }, (_, cycle) => {
    const striker = cycle % 2;
    const approach = approaches[1 - striker] ?? APPROACH_FRAMES;
    const presses = striker === slot
      ? Array.from({ length: STRIKES }, (_, strike): Press => ({ at: approach + 4 + strike * STRIKE_EVERY, keys: [smash], hold: 4 }))
      : approachStep(slot, approach).presses;
    return afterReset(`charge ${cycle + 1}`, presses, approach + 4 + STRIKES * STRIKE_EVERY);
  });
}

const rest = (): SmokeStep => afterReset("rest", [], 0);

const ultimate = (): SmokeStep[] => [afterReset("Ultimate", [tap([key(Action.attack), key(Action.special)])], SPECIAL_TAIL, special("ultimate")), rest()];

export function bindingSweep(): SmokeStep[] {
  const jumps = [key(Action.jump), key(Action.jump, true), key(Action.shortHop)];
  return SMOKE_BINDINGS.keys.filter((bound) => bound !== 0).map((bound): SmokeStep => ({ name: `binding ${keyName(bound)}`, presses: [tap([bound], 6)], frames: jumps.includes(bound) ? 60 : 30, binding: bound }));
}

export function smokeMoves(facing: 1 | -1): readonly SmokeStep[] {
  const toward = facing > 0 ? Action.moveRight : Action.moveLeft;
  const away = facing > 0 ? Action.moveLeft : Action.moveRight;
  const smashToward = facing > 0 ? Action.smashRight : Action.smashLeft;
  const smashAway = facing > 0 ? Action.smashLeft : Action.smashRight;
  const walk = key(Action.walk);
  const move = (name: string, presses: readonly Press[], expect: MoveClass, frames = 60) => afterReset(name, presses, frames, expect);
  const aerial = (name: string, press: Action, style: AttackStyle) => move(name, [tap([key(Action.jump)], 5), { at: 12, keys: [key(press)], hold: 4 }], attack(style));
  return [
    move("Jab", [tap([key(Action.attack)])], attack(AttackStyle.jab, AttackStyle.shot, AttackStyle.jab2, AttackStyle.jab3)),
    move("Forward tilt", [tap([walk, key(toward), key(Action.attack)])], attack(AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown)),
    move("Up tilt", [tap([walk, key(Action.moveUp), key(Action.attack)])], attack(AttackStyle.upTilt)),
    move("Down tilt", [tap([walk, key(Action.moveDown), key(Action.attack)])], attack(AttackStyle.downTilt)),
    move("Forward smash", [tap([key(smashToward)])], attack(AttackStyle.forwardSmash)),
    move("Up smash", [tap([key(Action.smashUp)])], attack(AttackStyle.upSmash)),
    move("Down smash", [tap([key(Action.smashDown)])], attack(AttackStyle.downSmash)),
    move("Grab", [tap([key(Action.grab)])], attack(AttackStyle.grab)),
    move("Dash attack", [{ at: 0, keys: [key(away)], hold: 34 }, { at: 18, keys: [key(Action.attack)], hold: 4 }, { at: 26, keys: [key(Action.attack)], hold: 4 }], attack(AttackStyle.dashAttack, AttackStyle.demonHunterDashAttack)),
    aerial("Neutral air", Action.attack, AttackStyle.neutralAir),
    aerial("Forward air", smashToward, AttackStyle.forwardAir),
    aerial("Back air", smashAway, AttackStyle.backAir),
    aerial("Up air", Action.smashUp, AttackStyle.upAir),
    aerial("Down air", Action.smashDown, AttackStyle.downAir),
    move("Neutral special", [tap([key(Action.special)])], special("neutral"), SPECIAL_TAIL),
    move("Side special", [tap([key(toward), key(Action.special)])], special("side"), SPECIAL_TAIL),
    move("Side special away", [tap([key(away), key(Action.special)])], special("side"), SPECIAL_TAIL),
    move("Up special", [tap([key(Action.moveUp), key(Action.special)])], special("up"), SPECIAL_TAIL),
    move("Down special", [tap([key(Action.moveDown), key(Action.special)])], special("down"), SPECIAL_TAIL),
  ];
}

export function smokeSchedule(approaches: readonly [number, number]): readonly SmokeSegment[] {
  return [
    [{ slot: 0, steps: bindingSweep() }, { slot: 1, steps: bindingSweep() }],
    [{ slot: 0, steps: [...smokeMoves(facingOf(0)), rest()] }, { slot: 1, steps: [...smokeMoves(facingOf(1)), rest()] }],
    [{ slot: 0, steps: charge(0, approaches) }, { slot: 1, steps: charge(1, approaches) }],
    [{ slot: 0, steps: ultimate() }, { slot: 1, steps: ultimate() }],
  ];
}

export interface SettlePoint {
  readonly step: string;
  readonly special: boolean;
  readonly frame: number;
}

export function settlePoints(steps: readonly SmokeStep[]): SettlePoint[] {
  const points: SettlePoint[] = [];
  let start = 0;
  for (const step of steps) {
    if (step.presses[0] === RESET) points.push({ step: step.name, special: step.expect?.kind === "special", frame: start + SETTLE_AT });
    start += step.frames;
  }
  return points;
}

export const tapeFrames = (steps: readonly SmokeStep[]): number => steps.reduce((total, step) => total + step.frames, 0);

export const segmentFrames = (segment: SmokeSegment): number => Math.max(0, ...segment.map(({ steps }) => tapeFrames(steps)));
const KEY_NAMES: Readonly<Record<number, string>> = { 32: "space", 186: "semicolon", 191: "slash" };

export const keyName = (code: number): string => KEY_NAMES[code] ?? String.fromCharCode(code).toLowerCase();

interface KeyEdge {
  readonly frame: number;
  readonly down: boolean;
  readonly key: number;
}

function edges(steps: readonly SmokeStep[]): KeyEdge[] {
  const list: KeyEdge[] = [];
  let start = 0;
  for (const step of steps) {
    for (const press of step.presses) {
      for (const pressed of press.keys) {
        list.push({ frame: start + press.at, down: true, key: pressed });
        list.push({ frame: start + press.at + press.hold, down: false, key: pressed });
      }
    }
    start += step.frames;
  }
  return list.sort((a, b) => a.frame - b.frame || Number(a.down) - Number(b.down));
}

export const FRAME_MILLIS = 1000 / 60;

export function xdotoolArgs(steps: readonly SmokeStep[], pace = 1): string[] {
  const args: string[] = [];
  let frame = 0;
  for (const edge of edges(steps)) {
    if (edge.frame > frame) args.push("sleep", ((edge.frame - frame) * FRAME_MILLIS / 1000 / pace).toFixed(3));
    frame = edge.frame;
    // xdotool sleeps 12 ms after every key event unless told otherwise, which would stretch each edge past its frame.
    args.push(edge.down ? "keydown" : "keyup", "--delay", "0", keyName(edge.key));
  }
  return args;
}

export function heldMasks(steps: readonly SmokeStep[], bindings: KeyBindings): number[] {
  const masks = new Array<number>(tapeFrames(steps)).fill(0);
  const counts = new Map<number, number>();
  const timeline = edges(steps);
  let next = 0;
  for (let frame = 0; frame < masks.length; frame++) {
    while (next < timeline.length && (timeline[next]?.frame ?? Infinity) <= frame) {
      const edge = timeline[next];
      if (edge !== undefined) counts.set(edge.key, (counts.get(edge.key) ?? 0) + (edge.down ? 1 : -1));
      next++;
    }
    let held = 0;
    for (const [pressed, count] of counts) {
      const action = count > 0 ? actionFor(bindings, pressed) : undefined;
      if (action !== undefined) held |= 1 << action;
    }
    masks[frame] = held;
  }
  return masks;
}

export function keyboardRows(masks: readonly number[]): InputRow[] {
  const capture = keyboardCapture();
  return masks.map((held) => {
    sampleKeys(capture, held);
    const row = emptyInput();
    copyInput(row, capture.row);
    commitEdges(capture);
    return row;
  });
}
