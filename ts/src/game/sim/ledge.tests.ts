import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character, LedgeState } from "./codes";
import { createFighter } from "./fighter";
import { snapToLedge } from "./ledge";
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
