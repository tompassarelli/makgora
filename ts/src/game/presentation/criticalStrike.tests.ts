import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../input/actions";
import { fighter, frame, scene } from "../match/padScene";
import { Character } from "../sim/codes";
import { length } from "../fighters/blademaster/moves";
import { QUICKDRAW_CHARGE, quickdrawDamage } from "../fighters/blademaster/specials";
import { criticalStrikeDamage, criticalStrikeSize, criticalStrikeText } from "./criticalStrike";

const FOE_X = length(f32(0.8));
const WATCH = 160;

function critsOf(holdFrames: number, attack: Action): { readonly shown: readonly number[]; readonly dealt: number } {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: Character.rifleman, x: FOE_X, facing: -1 }]);
  const foe = fighter(s, 1);
  const shown: number[] = [];
  for (let n = 1; n <= WATCH; n++) {
    const damageBefore = foe.status.damage;
    const hitBefore = foe.visuals.hit;
    frame(s, n <= holdFrames ? [attack] : []);
    const critical = criticalStrikeDamage(s.world, 1, foe.visuals.hit !== hitBefore, damageBefore);
    if (critical !== undefined) shown.push(critical);
  }
  return { shown, dealt: foe.status.damage };
}

test("Quickdraw's red critical number shows exactly the damage it dealt, once per hit, uncharged and full [k1 scenario]", () => {
  const tap = critsOf(1, Action.special);
  const full = critsOf(QUICKDRAW_CHARGE.hold + QUICKDRAW_CHARGE.full + 20, Action.special);
  assertEquals(tap.shown.join(" "), `${tap.dealt}`, "uncharged");
  assertEquals(full.shown.join(" "), `${full.dealt}`, "full");
  assertEquals(full.dealt, quickdrawDamage(QUICKDRAW_CHARGE.stages), "full damage");
  assertEquals(`${criticalStrikeText(tap.dealt)} ${criticalStrikeText(full.dealt)}`, "7! 24!", "the tag text");
  assertGreaterThan(criticalStrikeSize(full.dealt), criticalStrikeSize(tap.dealt));
});

test("A jab shows no critical number [k1 scenario]", () => {
  const jab = critsOf(1, Action.attack);
  assertGreaterThan(jab.dealt, 0.0);
  assertEquals(jab.shown.length, 0, "no critical number");
});
