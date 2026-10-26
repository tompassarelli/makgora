import { assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, CandleState, Character } from "../codes";
import { beginFighterAttack } from "../attacks";
import { createFighter } from "../fighter";
import { mutableCandle } from "../fighterRest";
import { duelPair, stepDuel } from "../testDuel";
import { CANDLE_UNTOUCHED_FRAMES } from "./koboldCandle";

const TOE_GAP = 30.0;

function strikesFloorCandle(character: Character, style: AttackStyle): boolean {
  const { world, owner: attacker, target: kobold } = duelPair(createFighter(character, 0.0, 1), createFighter(Character.kobold, -600.0, 1));
  const candle = mutableCandle(kobold);
  candle.state = CandleState.resting;
  candle.surface = attacker.motion.surface;
  candle.x = attacker.motion.x + TOE_GAP;
  candle.z = attacker.motion.z;
  candle.timer = CANDLE_UNTOUCHED_FRAMES;
  beginFighterAttack(world, 0, style, false);
  for (let frame = 0; frame < 40; frame++) {
    stepDuel(world);
    if (candle.struck[0] !== undefined || candle.snuffSerial > 0) return true;
  }
  return false;
}

test("Forsaken Paladin's and Cairne's jab and tilts strike a Kobold candle resting on the floor at their toes [k1 scenario]", () => {
  for (const character of [Character.forsakenPaladin, Character.cairne]) {
    for (const style of [AttackStyle.jab, AttackStyle.forwardTilt, AttackStyle.upTilt, AttackStyle.downTilt]) {
      assertTrue(strikesFloorCandle(character, style));
    }
  }
});
