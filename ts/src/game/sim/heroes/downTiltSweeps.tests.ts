import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { AttackStyle, Character } from "../codes";
import { createFighter } from "../fighter";
import { fighterAt } from "../roster";

const CROUCH_FRAMES = 20;
const WATCH_FRAMES = 40;
const DOWN = 1 << Action.moveDown;
const ATTACK = 1 << Action.attack;

function sweepsCrouchingFoe(character: Character, gap: number): { struck: boolean; style: AttackStyle | undefined; crouching: boolean } {
  const state = createReplaySnapshot();
  const sweeper = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(sweeper, createFighter(character, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.blademaster, gap, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 517;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  let style: AttackStyle | undefined;
  let crouching = false;
  for (let tick = 1; tick <= CROUCH_FRAMES + WATCH_FRAMES; tick++) {
    const press = tick === CROUCH_FRAMES ? ATTACK : 0;
    const sweep = inputRow({ held: DOWN | press, pressed: press, axisZ: -127 });
    const crouch = inputRow({ held: DOWN, axisZ: -127 });
    if (sweep === undefined || crouch === undefined) throw new Error("empty input row");
    adaptInput(sweep, sweeper, tick, state.controls.inputs[0], state.controls.commands[0]);
    adaptInput(crouch, foe, tick, state.controls.inputs[1], state.controls.commands[1]);
    crouching = foe.motion.crouching;
    stepMatch(state.match, state.world, state.controls, tick);
    style ??= sweeper.attack.style;
    if (foe.status.damage > 0.0) return { struck: true, style, crouching };
  }
  return { struck: false, style, crouching };
}

test("Illidan's and Maiev's down tilts are leg sweeps that hit a crouching foe in front along the floor, replayed from inputs [k1 scenario]", () => {
  for (const [character, gap] of [[Character.demonHunter, 100.0], [Character.warden, 80.0]] as const) {
    const sweep = sweepsCrouchingFoe(character, gap);
    assertEquals(sweep.style, AttackStyle.downTilt, `fighter ${character} down tilts`);
    assertTrue(sweep.crouching);
    assertTrue(sweep.struck);
  }
});
