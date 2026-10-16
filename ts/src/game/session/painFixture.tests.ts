import { assertEquals, test } from "wisp/src/runtime/testing";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { queueAttack } from "../input/attackBuffer";
import { createBufferedFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { Phase, createMatchState } from "../lobby/lobbyState";
import { initializeMatchFighters } from "../match/step";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster, fighterAt } from "../sim/roster";
import { PAIN_SCENARIOS, initializePainScenario } from "./painFixture";

test("every pain scenario lands its height category on a victim already in its jab pose [blademaster's jab hurtbox rises above his stand] [k1 scenario]", () => {
  for (const [index, scenario] of PAIN_SCENARIOS.entries()) {
    const game = createMatchState();
    game.phase = Phase.match;
    const world = createRoster(3, [createFighter(Character.blademaster, -240.0, 1), createFighter(Character.blademaster, 240.0, -1)]);
    initializeMatchFighters(game, world);
    initializePainScenario(scenario, world);
    const controls = createBufferedFrameControls();
    const row = createMatchFrameInput();
    const runtime = createPacingAndPresentation();
    for (let frame = 1; frame <= 150; frame++) {
      if (frame === 146) for (const slot of [0, 1]) queueAttack(at(controls.commands, slot), { style: AttackStyle.jab, facing: 0, frame, mayCharge: false });
      captureFrame(row, frame, world.mask, controls, runtime);
      executeMatchFrame(row, game, world, controls, runtime, frame);
    }
    assertEquals(fighterAt(world, 0).visuals.hitHeight, floorDiv(index, 3));
    assertEquals(fighterAt(world, 0).visuals.hitStrength, floorMod(index, 3));
  }
});
