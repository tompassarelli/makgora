import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character, LedgeState } from "./codes";
import { createFighter } from "./fighter";
import { snapToLedge } from "./ledge";
import { controls } from "./testWorld";
import { duelPair, stepDuel } from "./testDuel";

const HANG_PROBE_LIMIT = 900;

function framesUntilLetGo(damage: number): number {
  const { world, owner } = duelPair(createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, -500.0, 1));
  owner.status.damage = damage;
  snapToLedge(world, 0, 0, 1);
  let frame = 0;
  while (owner.ledge.state === LedgeState.hang && frame < HANG_PROBE_LIMIT) {
    stepDuel(world);
    frame++;
  }
  return frame;
}

test("an idle hanger lets go of the ledge at frame 660 at 50% and frame 480 at 120% [k4 reference docs/design/melee-parity.md]", () => {
  assertEquals(framesUntilLetGo(50.0), 660);
  assertEquals(framesUntilLetGo(120.0), 480);
});

function hangingOn(side: number) {
  const { world, owner } = duelPair(createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, -500.0, 1));
  snapToLedge(world, 0, 0, side);
  stepDuel(world);
  stepDuel(world);
  return { world, owner };
}

function assertCStickDrop(side: number): void {
  const away = hangingOn(side);
  stepDuel(away.world, controls({ getupDirectionPressed: true, getupDirection: side }));
  const cAway = hangingOn(side);
  stepDuel(cAway.world, controls({ cStickSideFlick: side }));
  assertEquals(cAway.owner.ledge.state, LedgeState.none);
  assertEquals(cAway.owner.motion.vx, away.owner.motion.vx);
  assertEquals(cAway.owner.motion.vz, away.owner.motion.vz);
  assertEquals(cAway.owner.ledge.regrab, away.owner.ledge.regrab);
  const cToward = hangingOn(side);
  stepDuel(cToward.world, controls({ cStickSideFlick: -side }));
  assertEquals(cToward.owner.ledge.state, LedgeState.hang);
}

test("C-left on the left ledge drops like the stick away, and C-right toward the stage does not [k1 scenario]", () => {
  assertCStickDrop(-1);
});

test("C-right on the right ledge drops like the stick away, and C-left toward the stage does not [k1 scenario]", () => {
  assertCStickDrop(1);
});

test("dropping from the ledge with down held keeps a normal fall; a fresh down press after the drop fast-falls [k1 scenario]", () => {
  const held = hangingOn(1);
  stepDuel(held.world, controls({ down: true, ledgeVerticalPressed: -1 }));
  assertEquals(held.owner.ledge.state, LedgeState.none);
  for (let i = 0; i < 30; i++) stepDuel(held.world, controls({ down: true }));
  assertEquals(held.owner.motion.fastFalling, false);

  const fresh = hangingOn(1);
  stepDuel(fresh.world, controls({ down: true, ledgeVerticalPressed: -1 }));
  for (let i = 0; i < 4; i++) stepDuel(fresh.world, controls({ down: true }));
  stepDuel(fresh.world, controls());
  stepDuel(fresh.world, controls({ down: true }));
  assertEquals(fresh.owner.motion.fastFalling, true);
});
