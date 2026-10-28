import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { attackBuffer } from "../input/attackBuffer";
import { participantInputs } from "../input/participants";
import { captureNetworkFrame, createMatchFrameInput, resetMatchFrameInput } from "../match/frameInput";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { firstStateDifference } from "./difference";
import { ReplayCorrections, ReplayHistory } from "./history";
import { REPLAY_MAX_CORRECTION_FRAMES } from "./limits";
import { type TapeWorld, captureTape, createTapeWorld, executeTapeRow } from "./tapeWorld";

/**
 * Pit Lord stands 800 units from a Warden; her stick turns every 10 frames
 * and her rows arrive 4 frames late, so each turn is mispredicted and
 * repaired. Returns the scoped steps the repairs took and the first
 * difference from the same match repaired whole.
 */
function repairedAgainstWhole(cursed: boolean): { scoped: number; difference: string | undefined } {
  const late = 4;
  const world = (): TapeWorld => {
    const tape = createTapeWorld({ stocks: 99, humans: 2 });
    const pitLord = createFighter(Character.pitLord, -400.0, 1);
    const warden = createFighter(Character.warden, 400.0, -1);
    if (cursed) warden.status.cursedBy = 0;
    for (const fighter of [pitLord, warden]) fighter.status.stocks = 99;
    const live = { ...tape.live, world: createRoster(3, [pitLord, warden]) };
    for (const slot of [0, 1] as const) live.controls.commands[slot] = attackBuffer(4);
    return { live, snapshot: tape.snapshot };
  };
  const scoped = world();
  const whole = world();
  const histories = [new ReplayHistory(), new ReplayHistory()] as const;
  histories[0].scopedRepair = "auto";
  histories[1].scopedRepair = "off";
  const corrections = new ReplayCorrections();
  for (const history of histories) assertTrue(history.beginEpoch(1, 1, REPLAY_MAX_CORRECTION_FRAMES));
  assertTrue(corrections.beginEpoch(1));
  const actual = participantInputs();
  const predicted = participantInputs();
  const actualAt = (frame: number) => {
    actual[1].axisX = floorMod(floorDiv(frame, 10), 2) === 0 ? 100 : -100;
    return actual;
  };
  const row = createMatchFrameInput();
  let difference: string | undefined;
  const confirm = (frame: number) => {
    resetMatchFrameInput(row);
    assertTrue(captureNetworkFrame(row, frame, actualAt(frame), scoped.live.world, 3));
    corrections.clear();
    assertTrue(corrections.add(row));
    assertTrue(histories[0].correct(1, corrections, scoped.live) !== "rejected");
    assertTrue(histories[1].correct(1, corrections, whole.live) !== "rejected");
    difference ??= firstStateDifference(captureTape(whole), captureTape(scoped));
  };
  const last = 64;
  for (let frame = 1; frame <= last; frame++) {
    predicted[1].axisX = actualAt(Math.max(1, frame - late))[1].axisX;
    for (const [index, tape] of [scoped, whole].entries()) {
      resetMatchFrameInput(row);
      assertTrue(captureNetworkFrame(row, frame, predicted, tape.live.world, 3));
      assertTrue(histories[index === 0 ? 0 : 1].saveSpeculative(1, row, tape.live));
      assertTrue(executeTapeRow(tape, row));
    }
    if (frame > late) confirm(frame - late);
  }
  for (let frame = last - late + 1; frame <= last; frame++) confirm(frame);
  return { scoped: histories[0].scopedRepairSteps(), difference };
}

test("A repair never plays a cursed fighter apart from her curse's owner, so she stays cursed as when every fighter is repaired [k1 scenario]", () => {
  const free = repairedAgainstWhole(false);
  assertGreaterThan(free.scoped, 0);
  assertEquals(free.difference, undefined);
  const cursed = repairedAgainstWhole(true);
  assertEquals(cursed.difference, undefined);
});
