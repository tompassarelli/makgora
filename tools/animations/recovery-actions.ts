import { Character } from "../../ts/src/game/sim/codes";
import { DOWN_DAMAGE_FRAMES } from "../../ts/src/game/sim/down";
import { authoredPhysics } from "../../ts/src/game/sim/tuning";

export interface Phase { readonly at: number; readonly roll?: number; readonly yaw?: number; readonly lean?: number; readonly tuck?: number; readonly height?: number }
export interface Action { readonly pose: string; readonly frames: number; readonly phases: readonly Phase[]; readonly airborne?: boolean; readonly attack?: boolean }
const roll = (sign: number, down = false): readonly Phase[] => [
  { at: 0, roll: down ? sign * 90 : 0, tuck: down ? 0.25 : 0 },
  { at: 0.14, roll: sign * 30, tuck: 0.28 },
  { at: 0.35, roll: sign * 135, tuck: 0.3 },
  { at: 0.65, roll: sign * 265, tuck: 0.3 },
  { at: 0.86, roll: sign * 350, tuck: 0.18 },
  { at: 1, roll: sign * 360, tuck: 0 },
];
const LYING_KNOCKDOWN = new Set<Character>([Character.archimonde]);
const lying = (character: Character): Action[] => !LYING_KNOCKDOWN.has(character) ? [] : [
  { pose: "knockdown", frames: 30, phases: [{ at: 0 }, { at: 0.35, roll: 55, tuck: 0.08 }, { at: 0.8, roll: 90 }, { at: 1, roll: 90 }] },
  { pose: "downDamage", frames: DOWN_DAMAGE_FRAMES, phases: [{ at: 0, roll: 90 }, { at: 0.3, roll: 90, height: 10 }, { at: 1, roll: 90 }] },
];
export function actions(character: Character): Action[] {
  const transitions: Action[] = [
    { pose: "turn", frames: 8, phases: [{ at: 0, yaw: 180 }, { at: 0.4, yaw: 110 }, { at: 1, yaw: 0 }] },
    { pose: "stop", frames: 8, phases: [{ at: 0, lean: -20 }, { at: 0.4, lean: -25, tuck: 0.12 }, { at: 1 }] },
    { pose: "jumpSquat", frames: authoredPhysics(character).jumpSquatFrames, phases: [{ at: 0 }, { at: 0.6, tuck: 0.28, lean: 15 }, { at: 1, tuck: 0.3, lean: 12 }] },
    { pose: "airDodge", frames: 49, airborne: true, phases: [{ at: 0 }, { at: 0.08, tuck: 0.25, lean: -32 }, { at: 0.55, tuck: 0.25, lean: -32 }, { at: 1, lean: -10 }] },
    { pose: "tech", frames: 26, phases: [{ at: 0, roll: 85, tuck: 0.2 }, { at: 0.3, roll: 50, tuck: 0.35 }, { at: 0.65, roll: -10, tuck: 0.16 }, { at: 1 }] },
    { pose: "techForward", frames: 40, phases: roll(-1, true) },
    { pose: "techBackward", frames: 40, phases: roll(1, true) },
    { pose: "getUpRollForward", frames: 35, phases: roll(-1, true) },
    { pose: "getUpRollBackward", frames: 35, phases: roll(1, true) },
  ];
  if (character < 3) return transitions;
  return [...lying(character), ...transitions,
    { pose: "rollForward", frames: 31, phases: roll(-1) },
    { pose: "rollBackward", frames: 31, phases: roll(1) },
    { pose: "spotDodge", frames: 22, phases: [{ at: 0 }, { at: 0.1, lean: -35, tuck: 0.22 }, { at: 0.7, lean: -35, tuck: 0.22 }, { at: 1 }] },
    { pose: "getUp", frames: 30, phases: [{ at: 0, roll: 90 }, { at: 0.3, roll: 70, tuck: 0.2 }, { at: 0.75, roll: 15, tuck: 0.1 }, { at: 1 }] },
    { pose: "getUpAttack", frames: 49, attack: true, phases: [{ at: 0, roll: 90 }, { at: 0.2, roll: 65 }, { at: 16 / 49, roll: 15, yaw: 0 }, { at: 19 / 49, roll: 15, yaw: 180 }, { at: 0.65, roll: 8, yaw: 180 }, { at: 1, yaw: 360 }] },
    { pose: "ledgeClimb", frames: 25, phases: [{ at: 0, lean: 65, height: -60 }, { at: 0.45, lean: 30, height: -15 }, { at: 1 }] },
    { pose: "ledgeRoll", frames: 36, phases: roll(-1, true) },
    { pose: "ledgeAttack", frames: 40, attack: true, phases: [{ at: 0, lean: 65, height: -60 }, { at: 0.3, lean: 20, height: -10 }, { at: 0.5, lean: 15 }, { at: 1 }] },
  ];
}
export function phaseAt(phases: readonly Phase[], t: number): Required<Omit<Phase, "at">> {
  const a = phases.findLast(p => p.at <= t) ?? phases[0];
  const b = phases.find(p => p.at >= t) ?? phases.at(-1);
  if (a === undefined || b === undefined) throw new Error("Empty motion phases");
  const blend = a.at === b.at ? 0 : (t - a.at) / (b.at - a.at);
  const v = (key: keyof Omit<Phase, "at">) => (a[key] ?? 0) * (1 - blend) + (b[key] ?? 0) * blend;
  return { roll: v("roll"), yaw: v("yaw"), lean: v("lean"), tuck: v("tuck"), height: v("height") };
}
export function quaternion(y: number, z: number): Float32Array<ArrayBuffer> {
  const a = y * Math.PI / 360, b = z * Math.PI / 360;
  return new Float32Array([-Math.sin(a) * Math.sin(b), Math.sin(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.cos(a) * Math.cos(b)]);
}
