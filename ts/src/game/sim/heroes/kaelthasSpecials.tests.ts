import { assertDefined, assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../input/adapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, ProjectileKind, SpecialAction } from "../codes";
import { createFighter, placedObject, type Fighter } from "../fighter";
import { ROSTER_MANA } from "../mana";
import { fighterAt } from "../roster";
import { SUMMON_PHOENIX_FRAME } from "../ultimates";
import { FIREBALL, FIREBALL_LIMIT } from "./kaelthasSpecials";

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

function liveFireballs(kael: Readonly<Fighter>): number {
  let count = 0;
  for (const projectile of kael.projectiles) if (projectile.life > 0 && projectile.kind === ProjectileKind.hero && projectile.spec === FIREBALL) count++;
  return count;
}

test("Three Fireball presses leave at most two missiles live, and each flies level at one speed [k1 scenario]", () => {
  const { state, kael } = kaelMatch();
  state.match.ultimatesOff = true;
  const starts: number[] = [];
  let refused = false;
  let peak = 0;
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    const press = starts.length + (refused ? 1 : 0) < 3 && kael.special.action === SpecialAction.none;
    step(state, kael, tick, press ? maskOf(Action.special) : 0);
    if (press && kael.special.action === SpecialAction.heroNeutral) starts.push(tick);
    else if (press) {
      refused = true;
      assertEquals(liveFireballs(kael), FIREBALL_LIMIT, `frame ${tick}: the third press meets two live Fireballs`);
    }
    peak = Math.max(peak, liveFireballs(kael));
    assertTrue(liveFireballs(kael) <= FIREBALL_LIMIT);
    for (const projectile of kael.projectiles) {
      if (projectile.life <= 0 || projectile.spec !== FIREBALL) continue;
      assertEquals(projectile.z, FIREBALL.offsetZ, `frame ${tick}: Fireball height`);
      assertEquals(projectile.velocityZ, 0.0, `frame ${tick}: Fireball vertical speed`);
      assertEquals(projectile.velocityX, FIREBALL.velocityX, `frame ${tick}: Fireball speed`);
    }
  }
  assertEquals(starts.length, 2, "two Fireballs cast");
  assertTrue(refused);
  assertEquals(peak, FIREBALL_LIMIT);
});

test("Kael'thas's ultimate summons a phoenix companion after a short cast [k1 scenario]", () => {
  const { state, kael } = kaelMatch();
  state.match.ultimatesOff = false;
  kael.mana.points = ROSTER_MANA.max;
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
