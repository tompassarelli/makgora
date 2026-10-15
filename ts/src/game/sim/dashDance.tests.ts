import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../generated/state/fighterState";
import { firstFighterDifference, firstStateDifference } from "../replay/difference";
import { ReplayHistory } from "../replay/history";
import { captureTape, createTapeWorld, executeTapeRow } from "../replay/tapeWorld";
import { adaptInput } from "../input/adapter";
import { inputRow } from "../input/inputRow";
import { captureFrame, createMatchFrameInput } from "../match/frameInput";
import { fighterAt } from "./roster";
import { Character, GroundAction } from "./codes";
import { createFighter, type Fighter } from "./fighter";
import { advanceSolo, controls } from "./testWorld";

function sample(fighter: Fighter, direction: number, amplitude = 1.0, walking = false): void {
  advanceSolo(fighter, 0, controls({ direction, diStickValid: true, diStickX: f32(direction * amplitude), walking }), 0.0);
}

function dashFor(fighter: Fighter, facing: number, frames: number): void {
  for (let frame = 0; frame < frames; frame++) sample(fighter, facing);
}

test("dash dancing: 512 analog and digital timelines accept thirteen held frames, turn-run on fourteen, with zero transition or rollback mismatches [k2 property]", () => {
  let cases = 0;
  for (const character of [Character.demonHunter, Character.rifleman]) {
    for (const facing of [-1, 1]) {
      for (let hold = 1; hold <= 16; hold++) {
        for (const travel of [0, 1]) {
          for (const amplitude of [f32(0.79), f32(0.8), f32(0.81), 1.0]) {

            const digital = amplitude === 1.0;
            const fighter = createFighter(character, 0.0, facing);
            dashFor(fighter, facing, hold);
            if (travel === 1) sample(fighter, -facing, f32(0.79));
            const rollback = createFighter(character, 0.0, facing);
            copyFighterState(rollback, fighter, 1);
            const input = digital ? controls({ direction: -facing }) : controls({ direction: -facing, diStickValid: true, diStickX: f32(-facing * amplitude) });
            advanceSolo(fighter, 0, input, 0.0);
            advanceSolo(rollback, 0, input, 0.0);
            assertEquals(rollback.ground.action, fighter.ground.action);
            assertEquals(rollback.ground.actionFrame, fighter.ground.actionFrame);
            assertEquals(rollback.motion.x, fighter.motion.x);
            assertEquals(rollback.motion.vx, fighter.motion.vx);
            assertEquals(rollback.motion.stickSideAge, fighter.motion.stickSideAge);
            assertEquals(rollback.facing, fighter.facing);
            assertEquals(firstFighterDifference(fighter, rollback, 1, 1), undefined);
            const accepted = hold <= 13 && amplitude >= f32(0.8);
            assertEquals(fighter.ground.action === GroundAction.dash && fighter.ground.dashFrame === 1, accepted);
            if (accepted) assertEquals(fighter.facing, -facing);
            if (digital && travel === 0 && hold === 14) {
              assertEquals(fighter.ground.action, GroundAction.turnRun);
              assertEquals(fighter.facing, facing);
            }
            cases++;
          }
        }
      }
    }
  }
  assertEquals(cases, 512);
});

test("dash dancing: recorded analog reversal rows replay through the two-sample boundary [k1 scenario]", () => {
  for (const facing of [-1, 1]) {
    const make = () => createTapeWorld({ stocks: 1, humans: 2, first: createFighter(Character.rifleman, -240.0, facing), second: createFighter(Character.rifleman, 240.0, -facing) });
    const canonical = make();
    const replayed = make();
    const history = new ReplayHistory();
    assertTrue(history.beginEpoch(1, 1));
    const row = createMatchFrameInput();
    for (let frame = 1; frame <= 28; frame++) {
      const axis = frame <= 13 ? facing * 127 : frame === 14 ? -facing * 101 : frame <= 20 ? -facing * 102 : facing * 127;
      const recorded = assertDefined(inputRow({ axisX: axis }));
      adaptInput(recorded, fighterAt(canonical.live.world, 0), frame, canonical.live.controls.inputs[0], canonical.live.controls.commands[0]);
      assertTrue(captureFrame(row, frame, 3, canonical.live.controls, canonical.live.runtime));
      assertTrue(history.save(1, row, replayed.live));
      assertTrue(executeTapeRow(canonical, row));
      assertTrue(executeTapeRow(replayed, row));
      if (frame >= 15) assertTrue(history.replay(1, 14, frame, replayed.live));
      assertEquals(firstStateDifference(captureTape(canonical), captureTape(replayed)), undefined);
      if (frame === 15) assertEquals(fighterAt(canonical.live.world, 0).facing, -facing);
    }
  }
});
