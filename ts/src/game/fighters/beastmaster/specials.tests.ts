import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, ProjectileKind } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { fighterAt } from "../../sim/roster";

interface Duel {
  readonly state: ReplayState;
  readonly beastmaster: Fighter;
  readonly foe: Fighter;
  tick: number;
}

const THROW_TICK = 3;
const RUN_END = 140;
const THROW = inputRow({ held: maskOf(Action.special), pressed: maskOf(Action.special) });
const IDLE = inputRow({});

function duel(foeAhead: number): Duel {
  const state = createReplaySnapshot();
  const beastmaster = fighterAt(state.world, 0);
  const other = fighterAt(state.world, 1);
  copyFighterState(beastmaster, createFighter(Character.beastmaster, 0.0, 1), 3);
  copyFighterState(other, createFighter(Character.medivh, foeAhead, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, beastmaster, foe: other, tick: 0 };
}

function step(d: Duel): void {
  d.tick++;
  const first = d.tick === THROW_TICK ? THROW : IDLE;
  if (first === undefined || IDLE === undefined) throw new Error("Beastmaster input row");
  adaptInput(first, d.beastmaster, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  adaptInput(IDLE, d.foe, d.tick, d.state.controls.inputs[1], d.state.controls.commands[1]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

const liveAxes = (f: Readonly<Fighter>) => f.projectiles.filter((projectile) => projectile.life > 0 && projectile.kind === ProjectileKind.hero);

test("Wild Axes fly straight out about 3H, then vanish with no return leg and no hitbox afterwards [k3 measure docs/design/beastmaster.md]", () => {
  const d = duel(2000.0);
  let lastLive = 0;
  const reachBySlot = new Map<number, number>();
  let farthest = 0.0;
  let retreated = false;
  let seen = 0;
  for (let tick = 1; tick <= RUN_END; tick++) {
    step(d);
    const axes = liveAxes(d.beastmaster);
    seen = Math.max(seen, axes.length);
    if (axes.length === 0) continue;
    lastLive = tick;
    for (const axe of axes) {
      const slot = d.beastmaster.projectiles.indexOf(axe);
      const reach = axe.x - d.beastmaster.motion.x;
      if (reach < (reachBySlot.get(slot) ?? reach) - f32(0.001)) retreated = true;
      reachBySlot.set(slot, reach);
      farthest = Math.max(farthest, reach);
    }
  }
  assertEquals(seen, 2);
  assertTrue(!retreated);
  assertGreaterThan(farthest, f32(2.5) * HERO_REFERENCE_HEIGHT);
  assertTrue(farthest < f32(3.3) * HERO_REFERENCE_HEIGHT);
  assertTrue(lastLive < RUN_END - 40);
  assertEquals(liveAxes(d.beastmaster).length, 0);
  assertEquals(d.foe.status.damage, 0.0);
});

test("A rollback replays a Wild Axes throw through its last live frame to the live checksum [k1 scenario]", () => {
  for (const save of [2, 10, 20, 30, 45, 60]) {
    const run = duel(2000.0);
    const snapshot = createReplaySnapshot();
    for (let tick = 1; tick <= RUN_END; tick++) {
      if (tick === save) copyReplayState(snapshot, run.state);
      step(run);
    }
    const expected = canonicalState(run.state);
    copyReplayState(run.state, snapshot);
    run.tick = save - 1;
    for (let tick = save; tick <= RUN_END; tick++) step(run);
    assertEquals(canonicalState(run.state), expected);
  }
});
