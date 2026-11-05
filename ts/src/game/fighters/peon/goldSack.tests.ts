import { assertEquals, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { idiv } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";
import { FOLLOW_UP_FORM } from "../../sim/specials/schema";
import { GOLD_SACK_CHARGE, GOLD_SACK_DAMAGE } from "./specials";

const FULL = GOLD_SACK_CHARGE.full;
const IN_REACH = 70.0;

type Press = "press" | "hold" | "shield" | "none";

interface Duel {
  readonly state: ReplayState;
  readonly peon: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function duel(foeAhead: number): Duel {
  const state = createReplaySnapshot();
  const peon = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(peon, createFighter(Character.peon, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.peon, foeAhead, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, peon, foe, tick: 0 };
}

const PRESSES: Readonly<Record<Press, { readonly held: number; readonly pressed: number }>> = {
  press: { held: maskOf(Action.special), pressed: maskOf(Action.special) },
  hold: { held: maskOf(Action.special), pressed: 0 },
  shield: { held: maskOf(Action.special) | maskOf(Action.rightTrigger), pressed: maskOf(Action.rightTrigger) },
  none: { held: 0, pressed: 0 },
};

function step(d: Duel, press: Press): void {
  d.tick++;
  const row = inputRow(PRESSES[press]);
  if (row === undefined) throw new Error("Gold Sack input row");
  adaptInput(row, d.peon, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

function idle(d: Duel, frames: number): void {
  for (let frame = 0; frame < frames; frame++) step(d, "none");
}


function lift(fighter: Fighter, height: number): void {
  fighter.motion.z = height;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

const swungStage = (f: Readonly<Fighter>): number => f.special.form >= FOLLOW_UP_FORM ? idiv(f.special.form, FOLLOW_UP_FORM) - 1 : -1;


for (const [] of [["on the ground", false], ["in the air", true]] as const) {
}

const ROLLBACK_END = 200;
const RELEASE_TICK = 41;
const rollbackPress = (tick: number): Press => tick === 3 ? "press" : tick > 3 && tick < RELEASE_TICK ? "hold" : "none";

function replayFrom(saveTick: number): { readonly expected: string; readonly replayed: string; readonly swungAtSave: number } {
  const run = duel(IN_REACH);
  const snapshot = createReplaySnapshot();
  let swungAtSave = -1;
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) {
      copyReplayState(snapshot, run.state);
      swungAtSave = swungStage(run.peon);
    }
    step(run, rollbackPress(tick));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  for (let tick = saveTick; tick <= ROLLBACK_END; tick++) step(run, rollbackPress(tick));
  return { expected, replayed: canonicalState(run.state), swungAtSave };
}

test("A rollback replays a Gold Sack charge through its release to the same state [k1 scenario]", () => {
  const midCharge = replayFrom(20);
  assertEquals(midCharge.replayed, midCharge.expected);
  const midSwing = replayFrom(RELEASE_TICK + 8);
  assertEquals(midSwing.swungAtSave >= 0, true, "saved after the release swung");
  assertEquals(midSwing.replayed, midSwing.expected);
});

test("An air Gold Sack bonk that lands before its first active frame still swings and hits, and the sack is spent on a swing that came out [k3 measure docs/design/peasant.md]", () => {
  const d = duel(IN_REACH);
  lift(d.peon, 40.0);
  d.peon.special.charge = FULL;
  step(d, "press");
  idle(d, 60);
  assertEquals(d.foe.status.damage, f32(at(GOLD_SACK_DAMAGE, GOLD_SACK_CHARGE.stages)), "the full bonk lands on the ground");
  assertEquals(d.peon.special.charge, 0);
});
