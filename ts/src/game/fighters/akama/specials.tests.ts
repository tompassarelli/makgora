import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, ProjectileKind, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { cancelSpecialState, clearSpecialOnStock } from "../../sim/transitions";
import { type SpecialKit, FOLLOW_UP_FORM, chargeStage } from "../../sim/specials/schema";
import { standinSpecials } from "../standin/specials";
import { AKAMA_HERO } from "./kit";
import { type Duel, type Press, duel, idle, lift, step } from "./testDuel";
import { SHURIKEN_CHARGE, SHURIKEN_DAMAGE, SHURIKEN_FIRST, SHURIKEN_GAP, SHURIKEN_MOST, SHURIKEN_NEUTRAL, SHURIKEN_SPREAD, shurikenCount } from "./specials";

const HOLD = SHURIKEN_CHARGE.hold;
const FULL = SHURIKEN_CHARGE.full;
const NEAR = 70.0;
const FAR = 700.0;

function charge(d: Duel, ticks: number): void {
  step(d, "press");
  for (let tick = 1; tick < ticks; tick++) step(d, "hold");
}

const thrown = (f: Readonly<Fighter>): number => f.special.form >= FOLLOW_UP_FORM ? shurikenCount(idiv(f.special.form, FOLLOW_UP_FORM) - 1) : 0;
const inFlight = (f: Readonly<Fighter>): number => f.projectiles.filter((projectile) => projectile.life > 0 && projectile.kind === ProjectileKind.hero).length;

function volleyCount(ticks: number): number {
  const d = duel(FAR);
  charge(d, ticks);
  step(d, "none");
  const count = thrown(d.akama);
  idle(d, SHURIKEN_FIRST + SHURIKEN_GAP * (count - 1) + 1);
  assertEquals(inFlight(d.akama), count, "every shuriken of the volley is thrown");
  return count;
}

test("The shuriken count follows the charge from one on a tap up to six at full charge [k3 measure docs/design/roster.md]", () => {
  assertEquals(volleyCount(1), 1, "a tap throws one");
  assertEquals(volleyCount(HOLD + 2 * 15 + 3), 3, "one more per 15 frames held");
  assertEquals(volleyCount(HOLD + FULL + 20), SHURIKEN_MOST, "full charge throws six");
  assertEquals(volleyCount(HOLD + FULL + 120), SHURIKEN_MOST, "holding past full still throws six");
});

for (const [label, press] of [["shield", "shield"], ["jump", "jump"]] as const) {
  test(`${label} during the charge stores the count and leaves Akama actionable [k3 measure docs/design/roster.md]`, () => {
    const d = duel(FAR);
    charge(d, HOLD + 2 * 15);
    const banked = d.akama.special.charge;
    assertGreaterThan(banked, 0);
    step(d, press);
    idle(d, 12);
    assertEquals(d.akama.special.action, SpecialAction.none, "no special is running");
    assertEquals(d.akama.special.charge, banked, "the count is kept");
    assertEquals(inFlight(d.akama), 0, "nothing was thrown");
    assertEquals(d.akama.attack.cooldown, 0, "he may act at once");
  });
}

test("A stored count survives landing, a hit and a rollback snapshot copy, and a lost stock empties it [k3 measure docs/design/roster.md]", () => {
  const landing = duel(FAR);
  lift(landing.akama, 120.0);
  landing.akama.special.charge = FULL;
  idle(landing, 120);
  assertEquals(landing.akama.motion.grounded, true, "he landed");
  assertEquals(landing.akama.special.charge, FULL, "landing keeps the count");
  const struck = duel(NEAR);
  charge(struck, HOLD + 30);
  const banked = struck.akama.special.charge;
  assertGreaterThan(banked, 0);
  cancelSpecialState(struck.akama);
  assertEquals(struck.akama.special.action, SpecialAction.none, "the hit ends the stance");
  assertEquals(struck.akama.special.charge, banked, "being hit keeps the count");
  const source = createFighter(Character.akama, 0.0, 1);
  source.special.charge = 37;
  const copy = createFighter(Character.akama, 0.0, 1);
  copyFighterState(copy, source, 3);
  assertEquals(copy.special.charge, 37, "a snapshot copy keeps the count");
  clearSpecialOnStock(copy);
  assertEquals(copy.special.charge, 0, "a lost stock empties it");
});

const ROLLBACK_END = 90;
const RELEASE_TICK = 45;
const rollbackPress = (tick: number): Press => tick === 3 ? "press" : tick > 3 && tick < RELEASE_TICK ? "hold" : "none";

function replayFrom(saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(NEAR);
  const snapshot = createReplaySnapshot();
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    step(run, rollbackPress(tick));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  for (let tick = saveTick; tick <= ROLLBACK_END; tick++) step(run, rollbackPress(tick));
  return { expected, replayed: canonicalState(run.state) };
}

test("A rollback replays a shuriken charge through its release to the same state [k1 scenario]", () => {
  for (const saveTick of [20, RELEASE_TICK + 5]) {
    const { expected, replayed } = replayFrom(saveTick);
    assertEquals(replayed, expected);
  }
});

test("An aerial neutral special with a stored count throws that many at once with no charge, and spends the count [k3 measure docs/design/roster.md]", () => {
  const d = duel(FAR);
  lift(d.akama, 300.0);
  d.akama.special.charge = 2 * idiv(FULL, SHURIKEN_CHARGE.stages) + 1;
  const stored = shurikenCount(chargeStage(SHURIKEN_CHARGE, d.akama.special.charge));
  assertEquals(stored, 3);
  step(d, "press");
  assertEquals(thrown(d.akama), stored, "the press itself throws the stored count");
  assertEquals(d.akama.special.charge, 0, "the count is spent");
  idle(d, SHURIKEN_FIRST + SHURIKEN_GAP * stored);
  assertEquals(inFlight(d.akama), stored);
  const empty = duel(FAR);
  lift(empty.akama, 300.0);
  step(empty, "press");
  assertEquals(thrown(empty.akama), 1, "with nothing stored the air throw is a single shuriken");
});

test("Each shuriken flinches lightly, fans by the authored spread, and the full volley stays below 15% [k3 measure docs/design/roster.md]", () => {
  const followUp = SHURIKEN_NEUTRAL.air?.followUps?.find((entry) => entry.chargeStage === SHURIKEN_CHARGE.stages);
  const needles = followUp?.special.projectiles ?? [];
  assertEquals(needles.length, SHURIKEN_MOST);
  let total = 0.0;
  for (let index = 0; index < needles.length; index++) {
    const needle = at(needles, index);
    assertEquals(needle.effect.damage, SHURIKEN_DAMAGE);
    assertLessThan(needle.effect.growth, 20.0);
    assertEquals(needle.spawnFrame, SHURIKEN_FIRST + SHURIKEN_GAP * index);
    if (index > 0) assertEquals(f32(needle.velocityZ - at(needles, index - 1).velocityZ), SHURIKEN_SPREAD, "adjacent shurikens fan apart");
    total += needle.effect.damage;
  }
  assertLessThan(total, 15.0);
  const d = duel(NEAR);
  d.akama.special.charge = FULL;
  step(d, "press");
  idle(d, 60);
  assertGreaterThan(d.foe.status.damage, 0.0);
  assertLessThan(d.foe.status.damage, 15.0);
});

test("The full volley never leaves the foe in hitstun longer than Akama is in recovery [k3 measure docs/design/roster.md]", () => {
  const d = duel(NEAR);
  d.akama.special.charge = FULL;
  step(d, "press");
  let lastHit = -1;
  let seen = 0.0;
  let slack = 0;
  for (let tick = 0; tick < 80; tick++) {
    step(d, "none");
    if (d.foe.status.damage > seen) {
      seen = d.foe.status.damage;
      lastHit = tick;
      slack = (d.akama.special.duration - d.akama.special.frame) - d.foe.launch.hitstun;
    }
  }
  assertGreaterThan(lastHit, 0);
  assertEquals(slack >= 0, true, "Akama is still recovering when the foe is free");
});

function outline(kit: SpecialKit | undefined): string {
  let text = `${kit?.name} ${kit?.description}`;
  for (const form of [kit?.ground, kit?.air]) {
    text += ` / ${form?.endFrame} ${form?.landingLag} ${form?.helpless}`;
    for (const region of form?.regions ?? []) text += ` r${region.firstFrame}-${region.lastFrame} ${region.hit.effect.damage} ${region.hit.effect.growth}`;
    for (const segment of form?.motion ?? []) text += ` m${segment.velocityX}`;
  }
  return text;
}

test("Akama's other specials stay the stand-in's [k3 measure docs/design/standins.md]", () => {
  const shared = standinSpecials(Character.akama, { bolt: "", burst: "" });
  assertEquals(outline(AKAMA_HERO.specials?.side), outline(shared.side));
  assertEquals(outline(AKAMA_HERO.specials?.down), outline(shared.down));
  assertEquals(AKAMA_HERO.specials?.neutral.name, "Shuriken Volley");
});
