import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action } from "../input/actions";
import { Character, SurfaceContact } from "../sim/codes";
import { mainDeckRight } from "../sim/stage";
import { fighter, frame, framesUntil, solo, tumbling } from "./padScene";

const LAST_FRAME = 40;

/** The first frame, counting the wall contact as frame 1, on which one press of `press` starts an action, or 0 when none does by LAST_FRAME. */
export function wallTechActionableFrame(character: Character, press: Action): number {
  for (let at = 2; at <= LAST_FRAME; at++) {
    const s = solo(0, character);
    const f = fighter(s);
    tumbling(f, mainDeckRight(0) + 30.0, -30.0);
    f.launch.knockbackX = -18.0;
    framesUntil(s, () => f.surfaceRecovery.contactSerial > 0, 10, (n) => n === 1 ? [Action.leftTrigger] : []);
    if (f.surfaceRecovery.state !== SurfaceContact.techWall) return 0;
    for (let n = 2; n < at; n++) frame(s, []);
    const jumps = f.jump.serial;
    frame(s, [press]);
    if (f.attack.style !== undefined || f.dodge.airDodging || f.jump.serial !== jumps) return at;
  }
  return 0;
}

test("Wall tech: an attack or an air dodge pressed on any frame before 32 does nothing, and either starts on frame 32 (Fox's Tech-Wall total 31, fightcore.csv) [k4 reference melee]", () => {
  for (const character of [Character.rifleman, Character.demonHunter]) {
    assertEquals(wallTechActionableFrame(character, Action.attack), 32);
    assertEquals(wallTechActionableFrame(character, Action.leftTrigger), 32);
  }
});
