import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { participantInputs } from "../input/participants";
import { captureNetworkFrame, createMatchFrameInput, resetMatchFrameInput } from "../match/frameInput";
import { firstStateDifference } from "./difference";
import { ReplayHistory } from "./history";
import { REPLAY_MAX_CORRECTION_FRAMES } from "./limits";
import { copyReplayState } from "./snapshot";
import { captureTape, createTapeWorld, executeTapeRow } from "./tapeWorld";

test("A confirmed world one frame behind the speculative one takes each frame's state from it and matches straight play [k1 scenario]", () => {
  const speculative = createTapeWorld({ stocks: 99, humans: 2 });
  const confirmed = createTapeWorld({ stocks: 99, humans: 2 });
  const straight = createTapeWorld({ stocks: 99, humans: 2 });
  const history = new ReplayHistory();
  assertTrue(history.beginEpoch(1, 1, REPLAY_MAX_CORRECTION_FRAMES));
  const inputs = participantInputs();
  const inputsAt = (frame: number) => {
    inputs[0].axisX = floorMod(floorDiv(frame, 7), 2) === 0 ? 100 : -100;
    inputs[1].axisX = floorMod(floorDiv(frame, 11), 2) === 0 ? -100 : 100;
    return inputs;
  };
  const row = createMatchFrameInput();
  let borrowed = 0;
  let difference: string | undefined;
  const last = 90;
  for (let frame = 1; frame <= last + 1; frame++) {
    const settled = frame - 1;
    if (settled >= 1) {
      resetMatchFrameInput(row);
      assertTrue(captureNetworkFrame(row, settled, inputsAt(settled), confirmed.live.world, 3));
      const ran = history.stateAfter(1, settled, row, speculative.live);
      if (ran === undefined) assertTrue(executeTapeRow(confirmed, row));
      else {
        copyReplayState(confirmed.live, ran);
        borrowed++;
      }
      resetMatchFrameInput(row);
      assertTrue(captureNetworkFrame(row, settled, inputsAt(settled), straight.live.world, 3));
      assertTrue(executeTapeRow(straight, row));
      difference ??= firstStateDifference(captureTape(straight), captureTape(confirmed));
    }
    if (frame > last) continue;
    resetMatchFrameInput(row);
    assertTrue(captureNetworkFrame(row, frame, inputsAt(frame), speculative.live.world, 3));
    assertTrue(history.save(1, row, speculative.live));
    assertTrue(executeTapeRow(speculative, row));
  }
  assertGreaterThan(borrowed, last - 2);
  assertEquals(difference, undefined);
});
