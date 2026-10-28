import { assertDefined, assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, ProjectileKind, SpecialAction } from "../../sim/codes";
import { createFighter, placedObject, type Fighter } from "../../sim/fighter";
import { fillMeter } from "../../sim/meter";
import { fighterAt } from "../../sim/roster";
import { SUMMON_PHOENIX_FRAME } from "../../sim/ultimates";

const KAEL_X = -550.0;
const FOE_X = 550.0;
const WATCH_FRAMES = 120;

function kaelMatch(): { state: ReplayState; kael: Fighter } {
  const state = createReplaySnapshot();
  const kael = fighterAt(state.world, 0);
  copyFighterState(kael, createFighter(Character.kaelthas, KAEL_X, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, FOE_X, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 360;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  return { state, kael };
}

function step(state: ReplayState, kael: Fighter, tick: number, pressed: number): void {
  const row = inputRow({ held: pressed, pressed });
  if (row === undefined) throw new Error("Kael'thas input row");
  adaptInput(row, kael, tick, state.controls.inputs[0], state.controls.commands[0]);
  stepMatch(state.match, state.world, state.controls, tick);
}

test("Kael'thas's ultimate summons a phoenix companion after a short cast [k1 scenario]", () => {
  const { state, kael } = kaelMatch();
  state.match.ultimatesOff = false;
  fillMeter(kael);
  step(state, kael, 1, maskOf(Action.attack, Action.special));
  assertEquals(kael.special.action, SpecialAction.heroUltimate, "Summon Phoenix starts");
  for (let tick = 2; tick < SUMMON_PHOENIX_FRAME; tick++) {
    step(state, kael, tick, 0);
    assertEquals(placedObject(kael).life, 0, `frame ${tick}: no phoenix before the cast`);
  }
  for (let tick = SUMMON_PHOENIX_FRAME; tick <= SUMMON_PHOENIX_FRAME + 2; tick++) step(state, kael, tick, 0);
  assertGreaterThan(placedObject(kael).life, 0);
  assertDefined(placedObject(kael).spec?.companion, "the phoenix companion");
});
