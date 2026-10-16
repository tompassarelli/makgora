import { assertEquals, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character } from "../codes";
import { createFighter } from "../fighter";

test("Peon's forward tilt and both angles recover in 19 frames, as his design sheet lists [k3 measure docs/design/peasant.md]", () => {
  const normals = createFighter(Character.peon, 0.0, 1).tuning.moves?.normals;
  for (const style of [AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown]) {
    const move = normals?.[style];
    assertEquals(move === undefined ? undefined : move.totalFrames - move.startupFrames - move.activeFrames, 19, `style ${style}`);
  }
});
