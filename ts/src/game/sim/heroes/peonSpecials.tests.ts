import { assertEquals, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import { Character, SpecialAction } from "../codes";
import { type Fighter, createFighter } from "../fighter";
import { createReferenceContactFighter } from "../referenceRig";
import type { Controls, Roster } from "../roster";
import { controls } from "../testWorld";
import { duelPair, lift, stepDuel } from "../testDuel";
import { PEON_SPECIALS, REST_END_FRAME, REST_SLEEP_FRAMES, REST_SOUR_FRAME, REST_SWEET_FIRST, REST_SWEET_LAST } from "./peonSpecials";

const REST_DOWN = controls({ specialPressed: true, specialZ: -1, verticalDirection: -1 });
const [SWEET, SOUR] = PEON_SPECIALS.down.ground.regions ?? [];

const MASH: readonly Controls[] = [
  controls({ attackRequested: true, attackPressed: true }),
  controls({ jumpPressed: true }),
  controls({ specialPressed: true, specialX: 1, direction: 1 }),
  controls({ shield: true, shieldPressed: true }),
  controls({ direction: -1 }),
  controls({ airDodgePressed: true, direction: 1 }),
  controls({ groundDodgePressed: true, groundDodgeDirection: 1 }),
];

function rest(gap: number): { world: Roster; peon: Fighter; victim: Fighter } {
  const peon = createFighter(Character.peon, 0.0, 1);
  const victim = createReferenceContactFighter(gap, -1);
  const { world } = duelPair(peon, victim);
  stepDuel(world, REST_DOWN);
  return { world, peon, victim };
}

function firstHit(world: Roster, peon: Fighter, victim: Fighter): { frame: number; damage: number } {
  for (let step = 0; step < REST_SOUR_FRAME + 4; step++) {
    const before = victim.status.damage;
    stepDuel(world);
    if (victim.status.damage > before) return { frame: peon.special.frame, damage: victim.status.damage - before };
  }
  return { frame: -1, damage: 0.0 };
}

test("Rest's point-blank sweetspot lands on special frame 2 after one startup frame, and a foe just past its reach takes nothing [k1 scenario]", () => {
  assertEquals(REST_SWEET_FIRST, 2);
  assertEquals(REST_SWEET_LAST, 3);
  assertEquals(REST_SOUR_FRAME, 4);
  const close = rest(40.0);
  assertEquals(firstHit(close.world, close.peon, close.victim).frame, REST_SWEET_FIRST);
  const far = rest(70.0);
  assertEquals(firstHit(far.world, far.peon, far.victim).frame, -1);
});

test("Rest's centre sweetspot deals the kill hit while its wider outer ring only lands a weak frame-4 sourspot [k1 scenario]", () => {
  assertEquals(SWEET !== undefined && SOUR !== undefined, true, "Rest authors a sweetspot and a sourspot");
  const close = rest(40.0);
  assertEquals(firstHit(close.world, close.peon, close.victim).damage, SWEET!.hit.effect.damage);
  const outer = rest(60.0);
  const sour = firstHit(outer.world, outer.peon, outer.victim);
  assertEquals(sour.frame, REST_SOUR_FRAME);
  assertEquals(sour.damage, SOUR!.hit.effect.damage);
  assertEquals(SOUR!.hit.effect.damage * 2 <= SWEET!.hit.effect.damage && SOUR!.hit.effect.growth * 2 <= SWEET!.hit.effect.growth, true, "the sourspot is weak");
});

test("a grounded whiffed Rest sleeps the Peon for 225 frames in place, ignoring every input, then he acts again [k1 scenario]", () => {
  assertEquals(REST_SLEEP_FRAMES, 225);
  const { world, peon } = rest(400.0);
  const x = peon.motion.x;
  let asleep = 0;
  while (peon.special.action === SpecialAction.heroDown) {
    if (peon.special.frame >= REST_SOUR_FRAME) asleep++;
    assertEquals(peon.attack.style, undefined, `frame ${peon.special.frame} starts no attack`);
    assertEquals(peon.motion.grounded && peon.motion.x === x && !peon.shield.raised && peon.dodge.groundFrame === 0, true, `frame ${peon.special.frame} stays asleep in place`);
    stepDuel(world, MASH[imod(asleep, MASH.length)]);
  }
  assertEquals(asleep, REST_SLEEP_FRAMES);
  for (let step = 0; step < 6; step++) stepDuel(world, controls({ direction: -1 }));
  assertEquals(peon.motion.x < x, true, "he walks once awake");
});

test("an aerial Rest falls asleep in the air and keeps sleeping after landing until the same frame a grounded Rest wakes [k1 scenario]", () => {
  const peon = createFighter(Character.peon, 0.0, 1);
  const victim = createReferenceContactFighter(400.0, -1);
  const { world } = duelPair(peon, victim);
  lift(peon, 160.0);
  stepDuel(world, REST_DOWN);
  assertEquals(peon.special.action, SpecialAction.heroDown);
  assertEquals(!peon.motion.grounded, true, "Rest starts airborne");
  let landedAt = -1;
  let step = 0;
  while (peon.special.action === SpecialAction.heroDown) {
    if (landedAt < 0 && peon.motion.grounded) landedAt = peon.special.frame;
    assertEquals(peon.attack.style, undefined, `frame ${peon.special.frame} starts no attack`);
    assertEquals(peon.jump.squat, 0, `frame ${peon.special.frame} starts no jump`);
    stepDuel(world, MASH[imod(step++, MASH.length)]);
  }
  assertEquals(landedAt > REST_SOUR_FRAME && landedAt < REST_END_FRAME, true, `landed asleep on frame ${landedAt}`);
  assertEquals(step, REST_END_FRAME - 1);
});

test("Peon's Burrow and Pack Up stop his slide on the spot [k2 property]", () => {
  const peon = createFighter(Character.peon, 0.0, 1);
  const { world } = duelPair(peon, createFighter(Character.rifleman, 900.0, -1));
  const SIDE = controls({ specialPressed: true, specialX: 1, direction: 1 });
  for (const [move, action] of [["Burrow", SpecialAction.heroSide], ["Pack Up", SpecialAction.heroSide]] as const) {
    peon.motion.vx = peon.tuning.physics.runSpeed;
    stepDuel(world, SIDE);
    const x = peon.motion.x;
    assertEquals(peon.special.action, action, move);
    for (let tick = 0; tick < 60 && peon.special.action !== SpecialAction.none; tick++) {
      stepDuel(world);
      assertEquals(peon.motion.x, x, `${move} tick ${tick}`);
    }
  }
});
