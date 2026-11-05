import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { firstFighterDifference } from "../../../generated/state/fighterDifference";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Action } from "../../input/actions";
import { Phase } from "../../lobby/lobbyState";
import { fighter, frame, scene } from "../../match/padScene";
import { stepMatch } from "../../match/step";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { FOLLOW_UP_FORM } from "../../sim/specials/schema";
import { controls } from "../../sim/testWorld";

const FOE_X = 40.0;
const WATCH = 160;
const U = Action.moveUp;

interface Rise {
  readonly hits: number;
  readonly damage: number;
  readonly knockbackX: number;
  readonly knockbackZ: number;
  readonly hitstun: number;
  readonly actionable: number;
  readonly foeFree: number;
  readonly followUpHit: boolean;
  readonly secondUpSpecial: boolean;
}

function rise(percent: number, followUp: (k: number) => readonly Action[] = () => [], retryUp = false): Rise {
  const s = scene(0, [{ character: Character.thrall, x: 0.0, facing: 1 }, { character: Character.rifleman, x: FOE_X, facing: -1 }]);
  const thrall = fighter(s, 0);
  const foe = fighter(s, 1);
  foe.status.damage = percent;
  for (let n = 0; n < 10; n++) frame(s, [], []);
  let hits = 0;
  let lastDamage = percent;
  let knockbackX = 0.0;
  let knockbackZ = 0.0;
  let hitstun = 0;
  let actionable = -1;
  let foeFree = -1;
  let afterStrike = -1.0;
  let followUpHit = false;
  let secondUpSpecial = false;
  let struck = false;
  for (let n = 1; n <= WATCH; n++) {
    const free = actionable > 0;
    const stunned = foe.launch.hitstun > 0 || foe.launch.hitlag > 0;
    const held = n === 1 ? [U, Action.special] : free ? (retryUp && n === actionable + 1 ? [U, Action.special] : followUp(n - actionable)) : [];
    frame(s, held, []);
    if (foe.status.damage > lastDamage) {
      if (!free) hits++;
      else if (stunned) followUpHit = true;
      lastDamage = foe.status.damage;
    }
    if (!struck && thrall.special.form >= FOLLOW_UP_FORM) {
      struck = true;
      afterStrike = foe.status.damage;
      knockbackX = foe.launch.knockbackX;
      knockbackZ = foe.launch.knockbackZ;
      hitstun = foe.launch.hitstun;
    }
    if (struck && actionable < 0 && thrall.special.action === SpecialAction.none) actionable = n;
    if (struck && foeFree < 0 && foe.launch.hitstun === 0 && foe.launch.hitlag === 0) foeFree = n;
    if (free && n > actionable + 1 && thrall.special.action === SpecialAction.heroUp) secondUpSpecial = true;
  }
  return { hits, damage: afterStrike - percent, knockbackX, knockbackZ, hitstun, actionable, foeFree, followUpHit, secondUpSpecial };
}

test("A Rising Thunder hit leaves no second Up B in the same airtime [k1 scenario]", () => {
  assertEquals(rise(0.0, () => [], true).secondUpSpecial, false);
});

interface Bout {
  readonly state: ReplayState;
  readonly thrall: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function bout(): Bout {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.thrall, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.rifleman, FOE_X, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 412;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const b: Bout = { state, thrall: fighterAt(state.world, 0), foe: fighterAt(state.world, 1), tick: 0 };
  for (let n = 0; n < 3; n++) step(b);
  return b;
}

function step(b: Bout, first: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], controls());
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

test("A rollback in the middle of Rising Thunder's rise replays its hits, apex and follow-up state exactly [k1 scenario]", () => {
  const b = bout();
  step(b, controls({ specialPressed: true, specialZ: 1, specialHeld: true, verticalDirection: 1 }));
  for (let n = 0; n < 14; n++) step(b);
  const saved = createReplaySnapshot();
  copyReplayState(saved, b.state);
  const savedTick = b.tick;
  for (let n = 0; n < 50; n++) step(b);
  const expected = createReplaySnapshot();
  copyReplayState(expected, b.state);
  copyReplayState(b.state, saved);
  b.tick = savedTick;
  for (let n = 0; n < 50; n++) step(b);
  const mask = b.state.world.mask;
  assertGreaterThan(b.foe.status.damage, 18.0);
  assertEquals(firstFighterDifference(fighterAt(expected.world, 0), b.thrall, mask, mask), undefined);
  assertEquals(firstFighterDifference(fighterAt(expected.world, 1), b.foe, mask, mask), undefined);
});
