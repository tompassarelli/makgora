import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { airborne, fighter, frameRows, scene } from "../../match/padScene";
import { Character } from "../../sim/codes";
import { LOG_HEAVE_FIRST_ACTIVE, LOG_RISING, LOG_TIPPER } from "./specials";

const AIR_HEIGHT = 600.0;

function airHeave(height: number, foeX?: number): { readonly peon: ReturnType<typeof fighter>; readonly foe: ReturnType<typeof fighter>; readonly run: (this: void, frames: number, held?: (n: number) => readonly Action[]) => void } {
  const s = scene(0, [{ character: Character.peon, x: 0.0, facing: 1 }, { character: Character.rifleman, x: foeX ?? 900.0, facing: -1 }]);
  const peon = fighter(s, 0);
  const foe = fighter(s, 1);
  airborne(peon, 0.0, height);
  if (foeX !== undefined) airborne(foe, foeX, height);
  const run = (frames: number, held: (n: number) => readonly Action[] = (n) => (n === 1 ? [Action.moveRight, Action.special] : [])): void => {
    for (let n = 1; n <= frames; n++) frameRows(s, [held(n), []]);
  };
  return { peon, foe, run };
}




test("Peon's ground and air Log Heave hit a Rifleman standing at the log's far end on its first active frame [k3 measure docs/design/peasant.md]", () => {
  const farEnd = LOG_RISING[0]?.x2 ?? 0.0;
  const ground = scene(0, [{ character: Character.peon, x: 0.0, facing: 1 }, { character: Character.rifleman, x: farEnd, facing: -1 }]);
  const groundFoe = fighter(ground, 1);
  let groundFrame = 0;
  for (let n = 1; n <= LOG_HEAVE_FIRST_ACTIVE + 3 && groundFoe.status.damage === 0.0; n++) {
    frameRows(ground, [n === 1 ? [Action.moveRight, Action.special] : [], []]);
    groundFrame = fighter(ground, 0).special.frame;
  }
  assertEquals(groundFoe.status.damage, LOG_TIPPER.damage, "ground tipper damage");
  assertEquals(groundFrame, LOG_HEAVE_FIRST_ACTIVE, "ground hit frame");
  const { foe, peon, run } = airHeave(AIR_HEIGHT, farEnd);
  let airFrame = 0;
  for (let n = 1; n <= LOG_HEAVE_FIRST_ACTIVE + 3 && foe.status.damage === 0.0; n++) {
    run(1, n === 1 ? undefined : () => []);
    airFrame = peon.special.frame;
  }
  assertEquals(foe.status.damage, LOG_TIPPER.damage, "air tipper damage");
  assertEquals(airFrame, LOG_HEAVE_FIRST_ACTIVE, "air hit frame");
});
