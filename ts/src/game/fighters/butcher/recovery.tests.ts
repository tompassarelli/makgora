import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { airborne, fighter, frameSteered, scene } from "../../match/padScene";
import { chooseRecoveryInput } from "../../match/botRecovery";
import { Character, LedgeState, SpecialAction } from "../../sim/codes";
import { mainDeckRight, mainDeckZ } from "../../sim/stage";

const RECOVERY_WATCH = 120;

test("The computer Butcher, 250 past the right ledge just below deck height with no jump left, tethers to it with an air Meat Hook and hangs there [k1 scenario]", () => {
  const s = scene(0, [{ character: Character.butcher, x: 0.0, facing: -1 }, { character: Character.rifleman, x: -300.0, facing: 1 }]);
  const butcher = fighter(s, 0);
  const foe = fighter(s, 1);
  airborne(butcher, f32(mainDeckRight(0) + 250.0), f32(mainDeckZ(0) + 40.0));
  butcher.facing = -1;
  butcher.jump.remaining = 0;
  const used: string[] = [];
  let tethered = false;
  for (let n = 1; n <= RECOVERY_WATCH && butcher.ledge.state !== LedgeState.hang; n++) {
    frameSteered(s, () => 0, (controls, slot) => {
      if (slot === 0) chooseRecoveryInput(butcher, 0, n, controls, foe);
    });
    const move = butcher.special.action === SpecialAction.heroNeutral ? "Meat Hook" : butcher.special.action === SpecialAction.heroUp ? "Hook Swing" : "";
    if (move !== "" && used[used.length - 1] !== move) used.push(move);
    tethered ||= butcher.ledge.state === LedgeState.tether;
  }
  assertEquals(`${used.join(", ")}; tethered ${tethered}; hangs ${butcher.ledge.state === LedgeState.hang}`, "Meat Hook; tethered true; hangs true");
});
