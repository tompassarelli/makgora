import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../input/actions";
import { type RowFields, inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { adaptInput } from "./inputAdapter";
import { stepMatch } from "./step";
import { createReplaySnapshot } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { fighterAt } from "../sim/roster";
import { advanceFighterPose, createFighterPose } from "../presentation/fighterPose";
import { sweep } from "../core/sweep";

const A = maskOf(Action.attack), WALK = maskOf(Action.modX, Action.modY), D = maskOf(Action.moveDown), R = maskOf(Action.moveRight), U = maskOf(Action.moveUp);
const CR = maskOf(Action.cRight), CL = maskOf(Action.cLeft), CU = maskOf(Action.cUp), CD = maskOf(Action.cDown);

const idle = (frames: number): RowFields[] => Array.from({ length: frames }, () => ({}));
const hold = (frames: number, held: number, fields: RowFields = {}): RowFields[] =>
  Array.from({ length: frames }, (_, index) => ({ held, pressed: index === 0 ? held : 0, ...fields }));
const crouch = (frames: number): RowFields[] => hold(frames, D, { axisZ: -127 });
const run = (): RowFields[] => [...idle(5), ...hold(30, R, { axisX: 127 })];

interface TiltPath { readonly name: string; readonly rows: readonly RowFields[]; readonly style: AttackStyle }

const PATHS: readonly TiltPath[] = [
  { name: "C-right standing", rows: [...idle(5), { held: CR, pressed: CR }], style: AttackStyle.forwardTilt },
  { name: "C-left standing", rows: [...idle(5), { held: CL, pressed: CL }], style: AttackStyle.forwardTilt },
  { name: "C-up standing", rows: [...idle(5), { held: CU, pressed: CU }], style: AttackStyle.upTilt },
  { name: "C-down standing", rows: [...idle(5), { held: CD, pressed: CD }], style: AttackStyle.downTilt },
  { name: "Tilt + right + A", rows: [...idle(5), { held: WALK | R | A, pressed: WALK | R | A, axisX: 127 }], style: AttackStyle.forwardTilt },
  { name: "Tilt + down + A", rows: [...idle(5), { held: WALK | D | A, pressed: WALK | D | A, axisZ: -127 }], style: AttackStyle.downTilt },
  { name: "slow stick right then A", rows: [...idle(5), { held: R, pressed: R, axisX: 50 }, { held: R, axisX: 70 }, { held: R | A, pressed: A, axisX: 70 }], style: AttackStyle.forwardTilt },
  { name: "slow stick up then A", rows: [...idle(5), { held: U, pressed: U, axisZ: 40 }, { held: U, axisZ: 60 }, { held: U | A, pressed: A, axisZ: 60 }], style: AttackStyle.upTilt },
  { name: "A from a held crouch", rows: [...crouch(40), { held: D | A, pressed: A, axisZ: -127 }], style: AttackStyle.downTilt },
  { name: "C-down from a held crouch", rows: [...crouch(40), { held: D | CD, pressed: CD, axisZ: -127 }], style: AttackStyle.downTilt },
  { name: "C-right from a held crouch", rows: [...crouch(40), { held: D | CR, pressed: CR, axisZ: -127 }], style: AttackStyle.forwardTilt },
  { name: "C-up on the crouch release", rows: [...crouch(40), { held: CU, pressed: CU, released: D }], style: AttackStyle.upTilt },
  { name: "C-right one frame into the crouch rise", rows: [...crouch(40), { released: D }, { held: CR, pressed: CR }], style: AttackStyle.forwardTilt },
  { name: "up + A two frames into the crouch rise", rows: [...crouch(40), { released: D }, {}, { held: A | U, pressed: A | U, axisZ: 127 }], style: AttackStyle.upTilt },
  { name: "walking then A", rows: [...idle(5), ...hold(20, R, { axisX: 60 }), { held: R | A, pressed: A, axisX: 60 }], style: AttackStyle.forwardTilt },
  { name: "walking then C-up", rows: [...idle(5), ...hold(20, R, { axisX: 60 }), { held: R | CU, pressed: CU, axisX: 60 }], style: AttackStyle.upTilt },
  { name: "C-down in a dash", rows: [...idle(5), ...hold(4, R, { axisX: 127 }), { held: R | CD, pressed: CD, axisX: 127 }], style: AttackStyle.downTilt },
  { name: "C-right in a run", rows: [...run(), { held: R | CR, pressed: CR, axisX: 127 }], style: AttackStyle.forwardTilt },
  { name: "C-left in a run", rows: [...run(), { held: R | CL, pressed: CL, axisX: 127 }], style: AttackStyle.forwardTilt },
  { name: "C-up in a run", rows: [...run(), { held: R | CU, pressed: CU, axisX: 127 }], style: AttackStyle.upTilt },
  { name: "C-down in a run brake", rows: [...run(), { released: R }, { held: CD, pressed: CD }], style: AttackStyle.downTilt },
];

interface Start { readonly style: AttackStyle | undefined; readonly clip: number | undefined; readonly clipName: string; readonly animation: string }

function startOf(character: Character, rows: readonly RowFields[]): Start {
  const state = createReplaySnapshot();
  const fighter = fighterAt(state.world, 0);
  copyFighterState(fighter, createFighter(character, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.peon, 1500.0, -1), 3);
  state.match.phase = Phase.match;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const pose = createFighterPose();
  let tick = 0;
  for (const fields of rows) {
    tick++;
    const row = inputRow(fields);
    if (row === undefined) throw new Error("tilt path row");
    const serial = fighter.attack.serial;
    adaptInput(row, fighter, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    advanceFighterPose(pose, fighter, state.world, state.controls.inputs[0], false, false, fighter.attack.serial !== serial, false);
    if (tick < rows.length && fighter.attack.style !== undefined) throw new Error(`fighter ${character}: attacked before the tilt press`);
  }
  return { style: fighter.attack.style, clip: pose.clipIndex, clipName: pose.clipName, animation: pose.animation };
}

function checkTiltPaths(character: Character): void {
  const reference = new Map<AttackStyle, Start>();
  for (const path of [...PATHS].sort((a, b) => Number(b.name.endsWith("standing")) - Number(a.name.endsWith("standing")))) {
    const start = startOf(character, path.rows);
    const at = `fighter ${character}, ${path.name}`;
    assertEquals(start.style, path.style, `${at}: the tilt starts on the press frame`);
    const shown = reference.get(path.style);
    if (shown === undefined) reference.set(path.style, start);
    else {
      assertEquals(start.clip, shown.clip, `${at}: plays the tilt's clip from its first frame`);
      assertEquals(start.clipName, shown.clipName, `${at}: plays the tilt's named clip from its first frame`);
    }
  }
}

test("Every tilt input path starts its tilt on the press frame with the tilt's clip: C-stick, Tilt + direction, a slow stick, from a held crouch, during the crouch rise, walking, and out of a dash, a run or a run brake [k1 scenario]", () => {
  checkTiltPaths(Character.blademaster);
});

sweep("Every fighter starts each tilt input path's tilt on the press frame with the tilt's clip [k1 scenario]", () => {
  for (const character of Object.values(Character)) checkTiltPaths(character);
});
