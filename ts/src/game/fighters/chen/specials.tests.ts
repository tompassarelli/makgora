import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { f32 } from "wisp/src/sim/f32";
import { airborne, fighter, frame, scene, type Scene } from "../../match/padScene";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, HeroStatusKind, ParasolState, SpecialAction } from "../../sim/codes";
import { canAttack } from "../../sim/conditions";
import { createFighter } from "../../sim/fighter";
import { clearHeroStatus } from "../../sim/heroStatus";
import { PARASOL_FALL } from "../../sim/parasol";
import { mainDeckZ } from "../../sim/stage";
import { FOLLOW_UP_FORM } from "../../sim/specials/schema";
import { clearSpecialOnStock } from "../../sim/transitions";
import { BODY_SLAM_FIRST, CHEN_SPECIALS, IGNITE_BURN_EVERY, IGNITE_BURN_FRAMES, IGNITE_DAMAGE, KEG_CHARGE, KEG_SLOW_FRAMES } from "./specials";

const duel = (foeX: number, foe: Character = Character.rifleman): Scene =>
  scene(0, [{ character: Character.chen, x: 0.0, facing: 1 }, { character: foe, x: foeX, facing: -1 }]);

function run(s: Scene, frames: number, own: (n: number) => readonly Action[] = () => [], theirs: (n: number) => readonly Action[] = () => []): void {
  for (let n = 1; n <= frames; n++) frame(s, own(n), theirs(n));
}

function firstHitFrame(s: Scene, limit: number, own: (n: number) => readonly Action[]): number | undefined {
  const foe = fighter(s, 1);
  for (let n = 1; n <= limit; n++) {
    frame(s, own(n));
    if (foe.status.damage > 0.0) return n;
  }
  return undefined;
}

const SIDE_B = (n: number): readonly Action[] => (n === 1 ? [Action.moveRight, Action.special] : []);
const BODY_SLAM_END = 50;

test("Body Slam charges from frame 10, stops at the foe's body and pops it up, and Chen acts again while the foe is still in hitstun [k3 measure docs/design/chen.md]", () => {
  const s = duel(100.0);
  const chen = fighter(s, 0);
  const foe = fighter(s, 1);
  const hit = firstHitFrame(s, 40, SIDE_B);
  assertEquals(hit, BODY_SLAM_FIRST, "the slam's first active frame");
  assertTrue(chen.motion.x < foe.motion.x);
  let free = 0;
  while (!canAttack(chen) && free < 60) {
    frame(s);
    free++;
  }
  assertTrue(foe.launch.hitstun > 0);
  assertGreaterThan(foe.motion.z, 20.0);
  assertTrue(Math.abs(foe.motion.x - 100.0) < 60.0);
});

test("A missed Body Slam keeps Chen committed for its whole 50 frames [k3 measure docs/design/chen.md]", () => {
  const s = duel(900.0);
  const chen = fighter(s, 0);
  run(s, BODY_SLAM_END - 2, SIDE_B);
  assertEquals(chen.special.action, SpecialAction.heroSide, "still in the slam's end lag");
  assertEquals(canAttack(chen), false);
  run(s, 4);
  assertTrue(canAttack(chen));
});

const DOWN_B = [Action.moveDown, Action.special] as const;

test("A tapped keg soaks at level 1 with the short slow; a full keg throws itself and soaks at level 4 with the long slow [k3 measure docs/design/chen.md]", () => {
  const tap = duel(215.0);
  const tapFoe = fighter(tap, 1);
  run(tap, 2, (n) => (n === 1 ? DOWN_B : []));
  run(tap, 1, () => [Action.special]);
  assertTrue(fighter(tap, 0).special.form >= FOLLOW_UP_FORM);
  run(tap, 60);
  assertEquals(tapFoe.status.soakLevel, 1, "a tap soaks lightly");
  assertTrue(tapFoe.status.condition === HeroStatusKind.chill && tapFoe.status.conditionFrames <= KEG_SLOW_FRAMES[0]);
  const full = duel(215.0);
  const fullFoe = fighter(full, 1);
  let slowest = 0;
  for (let n = 1; n <= KEG_CHARGE.hold + KEG_CHARGE.full + 70; n++) {
    frame(full, n === 1 ? DOWN_B : []);
    if (fullFoe.status.condition === HeroStatusKind.chill) slowest = Math.max(slowest, fullFoe.status.conditionFrames);
  }
  assertEquals(fullFoe.status.soakLevel, 4, "a full keg soaks fully");
  assertGreaterThan(slowest, KEG_SLOW_FRAMES[2]);
  assertEquals(fighter(full, 0).special.charge, 0, "the throw spends the keg");
});

test("Getting hit while filling drops the keg: the next fill starts empty [k3 measure docs/design/chen.md]", () => {
  const s = duel(30.0, Character.chen);
  const chen = fighter(s, 0);
  run(s, 30, (n) => (n === 1 ? DOWN_B : []), (n) => (n === 25 ? [Action.attack] : []));
  assertEquals(chen.special.action === SpecialAction.heroDown, false, "the hit ends the fill");
  run(s, 60);
  fighter(s, 1).motion.x = 900.0;
  run(s, KEG_CHARGE.hold + 3, (n) => (n === 1 ? DOWN_B : []));
  assertTrue(chen.special.charge <= 3);
});

function breathOn(soakLevel: number): number {
  const s = duel(120.0);
  const foe = fighter(s, 1);
  if (soakLevel > 0) {
    foe.status.soakFrames = 200;
    foe.status.soakLevel = soakLevel;
  }
  run(s, 40, (n) => (n === 1 ? [Action.special] : []));
  assertEquals(foe.status.soakFrames, 0, "the flame dries the soak");
  run(s, 220);
  return foe.status.damage;
}

test("Breath of Fire on a fully soaked foe adds the level-4 bonus and burns for 180 frames; on a dry foe it adds nothing [k3 measure docs/design/chen.md]", () => {
  const dry = breathOn(0);
  const soaked = breathOn(4);
  const bonus = (IGNITE_DAMAGE[4] ?? 0.0) + (IGNITE_BURN_FRAMES[4] ?? 0) / IGNITE_BURN_EVERY;
  assertGreaterThan(dry, 0.0);
  assertTrue(Math.abs(soaked - dry - bonus) < 0.0625);
  const light = breathOn(1);
  const lightBonus = (IGNITE_DAMAGE[1] ?? 0.0) + (IGNITE_BURN_FRAMES[1] ?? 0) / IGNITE_BURN_EVERY;
  assertTrue(Math.abs(light - dry - lightBonus) < 0.0625);
});

const UP_B = (n: number): readonly Action[] => (n === 1 ? [Action.moveUp, Action.special] : []);

test("Storm Rise strikes with an electric hit [k3 measure docs/design/chen.md]", () => {
  const s = duel(40.0);
  const foe = fighter(s, 1);
  let electric = false;
  for (let n = 1; n <= 30; n++) {
    frame(s, UP_B(n));
    electric ||= foe.visuals.hitElectric;
  }
  assertGreaterThan(foe.status.damage, 0.0);
  assertTrue(electric);
});

test("After Storm Rise the parasol floats slowly, blocks specials and dodges, down closes it, and one aerial out of it ends helpless [k3 measure docs/design/chen.md]", () => {
  const s = duel(900.0);
  const chen = fighter(s, 0);
  airborne(chen, 0.0, f32(mainDeckZ(0) + 700.0));
  run(s, CHEN_SPECIALS.up.ground.endFrame + 1, UP_B);
  assertEquals(chen.special.parasol, ParasolState.open, "the parasol opens instead of helpless");
  assertEquals(chen.special.fall, false);
  run(s, 30);
  const terminal = chen.tuning.physics.terminalSpeed;
  assertTrue(chen.motion.vz >= -terminal * PARASOL_FALL - 0.0625);
  run(s, 2, () => [Action.special]);
  assertEquals(chen.special.action, SpecialAction.none, "no special out of the float");
  run(s, 2, () => [Action.rightTrigger]);
  assertEquals(chen.dodge.airDodging, false, "no air dodge out of the float");
  run(s, 2, () => [Action.moveDown]);
  assertEquals(chen.special.parasol, ParasolState.closed, "down closes it");
  run(s, 1, () => [Action.attack]);
  assertEquals(chen.special.parasol, ParasolState.spent, "the one aerial spends it");
  while (chen.attack.style !== undefined && !chen.motion.grounded) frame(s);
  assertEquals(chen.motion.grounded, false, "the aerial ends in the air");
  assertTrue(chen.special.fall);
});

test("Soak and parasol state survive a rollback snapshot copy and clear on stock loss [k3 measure docs/design/chen.md]", () => {
  const source = createFighter(Character.chen, 0.0, 1);
  source.status.soakFrames = 77;
  source.status.soakLevel = 3;
  source.special.parasol = ParasolState.spent;
  const copy = createFighter(Character.chen, 0.0, 1);
  copyFighterState(copy, source, 3);
  assertEquals(copy.status.soakFrames, 77);
  assertEquals(copy.status.soakLevel, 3);
  assertEquals(copy.special.parasol, ParasolState.spent);
  clearSpecialOnStock(copy);
  clearHeroStatus(copy);
  assertEquals(copy.special.parasol, ParasolState.none);
  assertEquals(copy.status.soakFrames, 0);
  assertEquals(copy.status.soakLevel, 0);
});
