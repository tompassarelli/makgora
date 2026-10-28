import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { f32 } from "wisp/src/sim/f32";
import { airborne, fighter, frame, scene } from "../../match/padScene";
import { Character, ParasolState } from "../../sim/codes";
import { mainDeckZ } from "../../sim/stage";
import { parasolShown } from "../../presentation/parasolLook";
import { CHEN_SPECIALS } from "./specials";

const UP_B = (n: number): readonly Action[] => (n === 1 ? [Action.moveUp, Action.special] : []);

function floatOver(height: number) {
  const s = scene(0, [{ character: Character.chen, x: 0.0, facing: 1 }, { character: Character.rifleman, x: 900.0, facing: -1 }]);
  const chen = fighter(s, 0);
  airborne(chen, 0.0, f32(mainDeckZ(0) + height));
  const shown: boolean[] = [], open: boolean[] = [];
  const step = (actions: readonly Action[] = []) => {
    frame(s, actions);
    shown.push(parasolShown(chen));
    open.push(chen.special.parasol === ParasolState.open);
  };
  return { chen, step, shown, open };
}

test("The parasol model shows exactly while the parasol is open: from Storm Rise's end until down closes it or an aerial spends it [k3 measure docs/design/chen.md]", () => {
  const { chen, step, shown, open } = floatOver(700.0);
  for (let n = 1; n <= CHEN_SPECIALS.up.ground.endFrame + 1; n++) step(UP_B(n));
  assertEquals(shown[CHEN_SPECIALS.up.ground.endFrame - 2], false, "hidden during the rise");
  assertEquals(parasolShown(chen), true, "shown once the float starts");
  for (let n = 0; n < 20; n++) step();
  step([Action.moveDown]);
  step([Action.moveDown]);
  assertEquals(parasolShown(chen), false, "down closes and hides it");
  step([Action.attack]);
  assertEquals(parasolShown(chen), false, "hidden through the aerial");
  assertEquals(shown.join(), open.join(), "shown on exactly the open frames");
});

test("The parasol hides when Chen lands out of the float [k3 measure docs/design/chen.md]", () => {
  const { chen, step, shown, open } = floatOver(260.0);
  for (let n = 1; n <= CHEN_SPECIALS.up.ground.endFrame + 1; n++) step(UP_B(n));
  assertEquals(parasolShown(chen), true, "shown while floating");
  for (let n = 0; n < 900 && !chen.motion.grounded; n++) step();
  step();
  assertEquals(chen.motion.grounded, true, "he lands");
  assertEquals(parasolShown(chen), false, "landing closes and hides it");
  assertEquals(shown.join(), open.join(), "shown on exactly the open frames");
});
