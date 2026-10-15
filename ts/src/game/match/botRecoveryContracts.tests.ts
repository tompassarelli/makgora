import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { copyControls, createRoster, neutralControls, type Controls } from "../sim/roster";
import { TOMB_OF_SARGERAS_STAGE } from "../sim/stage";
import { SEA_SURFACE_Z } from "../sim/stageHazards";
import { chooseRecoveryInput } from "./botRecovery";
import { produceComputerInput } from "./botPlay";
import { createFrameControls, type FrameControls } from "./controls";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";

function testRoster(first: Fighter, second: Fighter) {
  return createRoster(3, [first, second]);
}

function frameControls(first: Controls, second: Controls): FrameControls {
  const result = createFrameControls();
  copyControls(result.inputs[0], first);
  copyControls(result.inputs[1], second);
  return result;
}

test("a computer knocked off either side of the deck or the Tomb of Sargeras sea, with or without a jump left, recovers to solid ground without losing a stock [k1 scenario]", () => {
  for (const character of [Character.demonHunter, Character.rifleman, Character.mountainKing]) for (const stage of [0, TOMB_OF_SARGERAS_STAGE]) {
    for (const side of [-1, 1]) for (const jumps of [0, 1]) {
      const fighter = createFighter(character, side * 680.0, -side);
      const opponent = createFighter(character === Character.rifleman ? Character.rifleman : Character.rifleman, 0.0, side);
      const input = neutralControls();
      const opponentInput = neutralControls();
      const game = createMatchState();
      game.phase = Phase.match;
      game.stageChoice = stage;
      fighter.motion.z = stage === TOMB_OF_SARGERAS_STAGE ? SEA_SURFACE_Z : -40.0;
      fighter.motion.vz = -4.0;
      fighter.motion.grounded = false;
      fighter.motion.surface = undefined;
      fighter.jump.remaining = jumps;
      assertTrue(chooseRecoveryInput(fighter, stage, 0, input));
      for (let frame = 1; frame <= 180; frame++) {
        input.direction = 0;
        input.jumpPressed = false;
        input.jumpHeld = false;
        chooseRecoveryInput(fighter, stage, 0, input);
        stepMatch(game, testRoster(fighter, opponent), frameControls(input, opponentInput), frame);
      }
      assertFalse(fighter.status.out);
      assertEquals(fighter.status.stocks, 3);
      assertTrue(fighter.motion.grounded);
      assertTrue(Math.abs(fighter.motion.x) <= 600.0);
    }
  }
  for (const side of [-1, 1]) for (const tideFrame of [1, 601]) {
    const fighter = createFighter(Character.mountainKing, side * 300.0, -side);
    const opponent = createFighter(Character.rifleman, 0.0, side);
    const input = neutralControls();
    const opponentInput = neutralControls();
    const game = createMatchState();
    game.phase = Phase.match;
    game.stageChoice = TOMB_OF_SARGERAS_STAGE;
    game.matchFrame = tideFrame;
    fighter.motion.z = SEA_SURFACE_Z;
    fighter.motion.grounded = false;
    fighter.motion.surface = undefined;
    fighter.jump.remaining = 0;
    for (let frame = 1; frame <= 240; frame++) {
      input.direction = 0;
      input.jumpPressed = false;
      input.jumpHeld = false;
      chooseRecoveryInput(fighter, game.stageChoice, game.matchFrame, input);
      stepMatch(game, testRoster(fighter, opponent), frameControls(input, opponentInput), frame);
    }
    assertFalse(fighter.status.out);
    assertEquals(fighter.status.stocks, 3);
    assertTrue(fighter.motion.grounded);
  }
});
