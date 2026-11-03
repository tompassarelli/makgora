import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { fighter, frame, scene } from "../../match/padScene";
import { canAct } from "../../match/training";
import { Character } from "../../sim/codes";

const POUNCE = [Action.special, Action.moveRight];
const TOUCHING_GAP = 60.0;
const WATCHED_FRAMES = 120;
const GRAB_REACH_HEIGHT = 110.0;

test("A grab pressed while Vampiric Pounce's bitten foe falls back through its reach catches the foe before it lands [k1 scenario]", () => {
  for (const damage of [0.0, 40.0, 80.0]) {
    const s = scene(0, [{ character: Character.dreadlord, x: 0.0, facing: 1 }, { character: Character.rifleman, x: TOUCHING_GAP, facing: -1 }]);
    const owner = fighter(s, 0);
    const victim = fighter(s, 1);
    victim.status.damage = damage;
    frame(s, [], []);
    frame(s, POUNCE, []);
    let peaked = false;
    let pressedAt = 0;
    let caughtAt = 0;
    for (let tick = 1; tick <= WATCHED_FRAMES && caughtAt === 0; tick++) {
      peaked ||= victim.launch.hitstun > 0 && victim.motion.vz < 0.0;
      const press = peaked && pressedAt === 0 && canAct(owner) && victim.motion.z < GRAB_REACH_HEIGHT;
      if (press) pressedAt = tick;
      frame(s, press ? [Action.grab] : [], []);
      if (pressedAt > 0 && victim.grab.owner === 0) caughtAt = tick;
    }
    assertTrue(pressedAt > 0);
    assertEquals(victim.grab.owner, 0, `the grab caught the foe bitten at ${damage}%`);
  }
});
