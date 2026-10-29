import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { type Scene, fighter, frame, scene } from "../../match/padScene";
import { Character } from "../../sim/codes";

const COLUMN_GAP = 72.0;
const WATCHED_FRAMES = 60;
const UTHER_DAMAGE = 20.0;

function holyLightScene(healed: number): Scene {
  const s = scene(0, [{ character: Character.uther, x: 0.0, facing: 1 }, { character: Character.rifleman, x: COLUMN_GAP, facing: -1 }]);
  fighter(s, 0).status.damage = UTHER_DAMAGE;
  fighter(s, 0).status.healed = healed;
  frame(s, [], []);
  frame(s, [Action.special], []);
  for (let tick = 1; tick <= WATCHED_FRAMES; tick++) frame(s, [], []);
  return s;
}

test("Holy Light heals Uther 2% when its column hits [k1 scenario]", () => {
  const s = holyLightScene(0.0);
  assertGreaterThan(fighter(s, 1).status.damage, 0.0);
  assertEquals(fighter(s, 0).status.damage, UTHER_DAMAGE - 2.0, "the hit heals 2%");
  assertEquals(fighter(s, 0).status.healed, 2.0, "the heal counts toward this stock's limit");
});

test("Holy Light heals no more than 6% in one stock [k1 scenario]", () => {
  const s = holyLightScene(5.0);
  assertGreaterThan(fighter(s, 1).status.damage, 0.0);
  assertEquals(fighter(s, 0).status.damage, UTHER_DAMAGE - 1.0, "only the 1% left under the limit heals");
  assertEquals(fighter(s, 0).status.healed, 6.0, "the stock's limit is reached");
});
