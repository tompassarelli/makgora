import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { airborne, fighter, frameSteered, scene } from "../../match/padScene";
import { chooseRecoveryInput } from "../../match/botRecovery";
import { Character, LedgeState, SpecialAction } from "../../sim/codes";
import { placedObject } from "../../sim/fighter";
import { mainDeckRight, mainDeckZ } from "../../sim/stage";

const OUTSIDE = 700.0;
const RECOVERY_WATCH = 300;

test("The computer Blademaster, 700 past the right ledge at deck height with no jump left, steps toward the stage with side-B Mirror Image, then angles up-B and gets back without losing a stock [k1 scenario]", () => {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: -1 }, { character: Character.rifleman, x: -300.0, facing: 1 }]);
  const blademaster = fighter(s, 0);
  const foe = fighter(s, 1);
  airborne(blademaster, f32(mainDeckRight(0) + OUTSIDE), mainDeckZ(0));
  blademaster.jump.remaining = 0;
  const stocks = blademaster.status.stocks;
  const used: string[] = [];
  let back = false;
  for (let n = 1; n <= RECOVERY_WATCH && !back && blademaster.status.stocks === stocks; n++) {
    frameSteered(s, () => 0, (controls, slot) => {
      if (slot === 0) chooseRecoveryInput(blademaster, 0, n, controls, foe);
    });
    const move = blademaster.special.action === SpecialAction.heroSide ? "side-B" : blademaster.special.action === SpecialAction.heroUp ? "up-B" : "";
    if (move !== "" && used[used.length - 1] !== move) used.push(move);
    back = blademaster.ledge.state !== LedgeState.none || (blademaster.motion.grounded && blademaster.motion.x <= mainDeckRight(0));
  }
  assertEquals(`${used.join(", ")}; back ${back}; stocks lost ${stocks - blademaster.status.stocks}`, "side-B, up-B; back true; stocks lost 0");
});

const NEAR_LEDGE = 10.0;
const AIM_PROBE_FRAME = 3;

test("The computer Blademaster holds toward the stage through Mirror Image's aim frames even a step past the ledge, where it otherwise holds out, so side-B steps him in [k1 scenario]", () => {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: -1 }, { character: Character.rifleman, x: -300.0, facing: 1 }]);
  const blademaster = fighter(s, 0);
  const foe = fighter(s, 1);
  airborne(blademaster, f32(mainDeckRight(0) + OUTSIDE), mainDeckZ(0));
  blademaster.jump.remaining = 0;
  let held = 0;
  for (let n = 1; n <= RECOVERY_WATCH && held === 0; n++) {
    if (blademaster.special.action === SpecialAction.heroSide && blademaster.special.frame === AIM_PROBE_FRAME) blademaster.motion.x = f32(mainDeckRight(0) + NEAR_LEDGE);
    frameSteered(s, () => 0, (controls, slot) => {
      if (slot !== 0) return;
      chooseRecoveryInput(blademaster, 0, n, controls, foe);
      if (blademaster.special.action === SpecialAction.heroSide && blademaster.special.frame === AIM_PROBE_FRAME) held = controls.direction;
    });
  }
  assertEquals(held, -1, "stick held toward the stage");
});
