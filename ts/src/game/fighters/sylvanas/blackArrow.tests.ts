import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { fighter, frameRows, scene } from "../../match/padScene";
import { Character } from "../../sim/codes";
import { SYLVANAS_SPECIALS } from "./specials";

const FOE_DISTANCE = 3000.0;
const POINT_BLANK = 70.0;
const TICKS = 70;

interface Hop {
  readonly landed: number;
  readonly castStart: number;
  readonly spawn: number;
  readonly arrowRises: boolean;
  readonly foeFree: number;
  readonly sylvanasFree: number;
}

function shortHopArrow(facing: number, fastFall: boolean, up: boolean, foeAt: number, foeShields: boolean): Hop {
  const s = scene(0, [{ character: Character.sylvanas, x: 0.0, facing }, { character: Character.jaina, x: facing * foeAt, facing: -facing }]);
  const user = fighter(s), foe = fighter(s, 1);
  let airTicks = -1;
  let castStart = -1, spawn = -1, landed = -1, foeFree = -1, sylvanasFree = -1, contact = -1;
  let arrowRises = false;
  let life = 0;
  for (let tick = 1; tick <= TICKS; tick++) {
    if (!user.motion.grounded && airTicks < 0) airTicks = 0; else if (airTicks >= 0) airTicks++;
    const held: Action[] = [];
    if (tick === 1) held.push(Action.shortHop);
    if (airTicks === 0) held.push(Action.special);
    if (airTicks === 0 && up) held.push(Action.moveUp);
    if (fastFall && airTicks > 0 && !user.motion.grounded && user.motion.vz <= 0.0) held.push(Action.moveDown);
    frameRows(s, [held, foeShields ? [Action.rightTrigger] : []], (row, slot) => { if (slot === 0) row.specialZ = 0; });
    if (castStart < 0 && user.special.action !== 0) castStart = tick;
    const arrow = user.projectiles.find((projectile) => projectile.life > 0);
    if (spawn < 0 && arrow !== undefined && arrow.life > life) {
      spawn = tick;
      arrowRises = arrow.velocityZ > 0.0;
    }
    life = arrow?.life ?? 0;
    if (airTicks >= 0 && user.motion.grounded && landed < 0) landed = tick;
    if (contact < 0 && foe.shield.stun > 0) contact = tick;
    if (contact >= 0 && foeFree < 0 && foe.shield.stun === 0 && foe.launch.hitlag === 0) foeFree = tick;
    if (landed >= 0 && sylvanasFree < 0 && user.motion.grounded && user.special.action === 0 && user.landing.lag === 0) sylvanasFree = tick;
  }
  return { landed, castStart, spawn, arrowRises, foeFree, sylvanasFree };
}

test("Black Arrow leaves on frame 10 of 34 standing and in the air, with the same arrow, and its aerial landing lag stays 16 [k3 measure docs/design/sylvanas.md]", () => {
  const { ground, air } = SYLVANAS_SPECIALS.neutral;
  assertTrue(air !== undefined);
  assertEquals(ground.projectiles?.[0]?.spawnFrame, 10);
  assertEquals(air?.projectiles?.[0]?.spawnFrame, 10);
  assertEquals(ground.endFrame, 34);
  assertEquals(air?.endFrame, 34);
  assertEquals(air?.landingLag, 16);
});

test("A short-hop Black Arrow pressed on the first air frame, with or without a fast fall, leaves before she lands, aimed forward or held up, facing either way [k1 scenario]", () => {
  const { air } = SYLVANAS_SPECIALS.neutral;
  const spawnFrame = air?.projectiles?.[0]?.spawnFrame ?? 0;
  for (const facing of [1, -1]) {
    for (const fastFall of [false, true]) {
      for (const up of [false, true]) {
        const label = `facing ${facing}, ${fastFall ? "fast fall" : "no fast fall"}, ${up ? "up" : "forward"}`;
        const hop = shortHopArrow(facing, fastFall, up, FOE_DISTANCE, false);
        assertGreaterThan(hop.castStart, 0);
        assertEquals(hop.spawn, hop.castStart + spawnFrame - 1, `${label}: arrow leaves on its frame`);
        assertEquals(hop.spawn < hop.landed, true, `: before landing`);
        assertEquals(hop.arrowRises, up, `${label}: aim`);
      }
    }
  }
});

test("A short-hop Black Arrow on a shield at point blank leaves her behind on landing lag, a fast fall or not [k1 scenario]", () => {
  for (const fastFall of [false, true]) {
    const hop = shortHopArrow(1, fastFall, false, POINT_BLANK, true);
    assertGreaterThan(hop.foeFree, 0);
    assertEquals(hop.foeFree < hop.sylvanasFree, true, `${fastFall ? "fast fall" : "no fast fall"}: the shielder is free first`);
  }
});
