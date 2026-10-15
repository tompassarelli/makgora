import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ContactKind, SpecialAction } from "../codes";
import { collectDamageContact } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { runningHeroSpecial } from "../heroSpecialRules";
import { type Controls, createRoster, fighterAt } from "../roster";
import { duelPair, stepDuel } from "../testDuel";
import { contactBatch, controls, hitEffect } from "../testWorld";
import { Phase } from "../../match/rules";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot } from "../../replay/snapshot";
import { max } from "../../../runtime/numbers";
import { CANDLE_LEVEL_HEAT, candleLevel } from "./koboldCandle";

test("Kobold's candle gains 8 heat per whole percent he lands, at most 75 a hit, burns down 1 every third frame and goes out with his stock [k3 measure docs/design/roster.md]", () => {
  const state = { ...createReplaySnapshot(), world: createRoster(3, [createFighter(Character.kobold, -100.0, 1), createFighter(Character.rifleman, 100.0, -1)]) };
  state.match.phase = Phase.match;
  state.match.humanMask = 3;
  state.match.humanFighterMask = 3;
  state.match.practice = true;
  const { world } = state;
  const kobold = fighterAt(world, 0);
  const land = (damage: number, growth: number, base: number) => contactBatch(world, () => collectDamageContact(world, 0, 1, hitEffect(damage, growth, base, 1.0, 1.0), 1, ContactKind.launch, true, undefined, false));
  land(9.0, 63.0, 18.0);
  assertEquals(kobold.candle.heat, 72);
  assertEquals(candleLevel(kobold), 0);
  land(18.0, 104.0, 26.0);
  assertEquals(kobold.candle.heat, 147);
  assertEquals(candleLevel(kobold), 1);
  land(2.0, 50.0, 20.0);
  assertEquals(kobold.candle.heat, 163);
  assertEquals(candleLevel(kobold), 2);
  for (let frame = 1; frame <= 300; frame++) stepMatch(state.match, world, state.controls, frame);
  assertEquals(kobold.candle.heat, 63);
  kobold.motion.x = -100000.0;
  stepMatch(state.match, world, state.controls, 301);
  assertTrue(kobold.status.out);
  assertEquals(kobold.candle.heat, 0);
});

function litKobold(level: number, gap: number, input: Readonly<Controls>): { world: ReturnType<typeof createRoster>; kobold: Fighter; target: Fighter; startX: number } {
  const { world, owner, target } = duelPair(createFighter(Character.kobold, -400.0, 1), createFighter(Character.rifleman, -400.0 + gap, -1));
  owner.candle.heat = level * CANDLE_LEVEL_HEAT;
  const startX = owner.motion.x;
  stepDuel(world, input);
  return { world, kobold: owner, target, startX };
}

test("Kobold's candle level lengthens Wick Flick to 270/318/350/382 with an ember at full flame, Panic Dig to 165/182/198/215 with armor from level 2, and Mine! to 101 a side at level 3 [k3 measure docs/design/roster.md]", () => {
  const wickReach = [270.0, 318.0, 350.0, 382.0];
  const digTravel = [165.0, 182.0, 198.0, 215.0];
  const mineReach = [78.0, 86.0, 94.0, 101.0];
  for (let level = 0; level <= 3; level++) {
    const wick = litKobold(level, 1000.0, controls({ specialPressed: true }));
    assertEquals(wick.kobold.special.variant, level);
    let far = 0.0;
    let emberFrames = 0;
    for (let frame = 0; frame < 120; frame++) {
      for (const shot of wick.kobold.projectiles) {
        if (shot.spec === undefined) continue;
        far = max(far, shot.x - wick.startX);
        if (shot.life > 0 && shot.spec.velocityX === 0.0) emberFrames++;
      }
      stepDuel(wick.world);
    }
    assertNear(far, wickReach[level] ?? 0.0, 2.0);
    assertEquals(emberFrames, level === 3 ? 45 : 0);

    const dig = litKobold(level, 1000.0, controls({ specialPressed: true, specialX: 1 }));
    for (let frame = 2; frame <= 8; frame++) stepDuel(dig.world);
    const digFrom = dig.kobold.motion.x;
    for (let frame = 9; frame <= 23; frame++) stepDuel(dig.world);
    assertNear(dig.kobold.motion.x - digFrom, digTravel[level] ?? 0.0, 2.0);

    const jabbed = litKobold(level, 1000.0, controls({ specialPressed: true, specialX: 1 }));
    for (let frame = 2; frame <= 12; frame++) stepDuel(jabbed.world);
    contactBatch(jabbed.world, () => collectDamageContact(jabbed.world, 1, 0, hitEffect(5.0, 50.0, 20.0, -1.0, 0.0), 1, ContactKind.launch, true, undefined, false));
    stepDuel(jabbed.world);
    assertEquals(jabbed.kobold.special.action === SpecialAction.heroSide && jabbed.kobold.launch.hitstun === 0, level >= 2);

    const mine = litKobold(level, 1000.0, controls({ specialPressed: true, specialZ: -1 }));
    let ahead = 0.0;
    let behind = 0.0;
    for (const region of runningHeroSpecial(mine.kobold)?.regions ?? []) {
      const strike = region.hit.strike;
      if (strike === undefined) continue;
      ahead = max(ahead, strike.x2 + strike.radius);
      behind = max(behind, strike.radius - strike.x2);
    }
    assertNear(ahead, mineReach[level] ?? 0.0, 1.0);
    assertNear(behind, mineReach[level] ?? 0.0, 1.0);

    const struck = litKobold(level, 200.0, controls({ specialPressed: true }));
    for (let frame = 0; frame < 120; frame++) stepDuel(struck.world);
    const flame = level === 3 ? 7.5 : level === 2 ? 6.25 : 5.0;
    assertNear(struck.target.status.damage, level === 3 ? flame + 3.0 : flame, 0.125);
  }
});
