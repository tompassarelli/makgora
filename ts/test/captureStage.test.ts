import { expect, test } from "bun:test";
import { SCORED_NORMALS, SCORED_SPECIALS } from "../scripts/wisp/animScoreSample";
import { Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/roster/kits";
import { captureRequest } from "../src/game/session/devSettings";
import { CAPTURE_STAGE_CLEAR, captureStageCommand } from "../src/platform/captureFixtures";
import { CAPTURE_HOLD_FRAMES, CAPTURE_MOVES, CAPTURE_MOVE_LIMIT, CAPTURE_SLOT_X, advanceCaptureStage, captureMove, captureStaged, createCaptureLane, createCaptureStage } from "../src/platform/captureStage";

test("every fighter slug and scored move name parses as a capture command and stages a lane that plays the move, holds and loops in place [k2 property]", () => {
  expect(CAPTURE_MOVES.map(move => move.name)).toEqual([...SCORED_NORMALS, ...SCORED_SPECIALS].map(entry => entry.move));
  expect(captureRequest(CAPTURE_STAGE_CLEAR)).toEqual({ kind: "clear" });
  expect(captureRequest("-dev capture blademaster forward-air up 0")).toBeUndefined();
  expect(captureRequest("-dev capture blademaster forward-air right 4")).toBeUndefined();
  expect(captureRequest("-dev capture jaina up-tilt left 1")).toEqual({ kind: "stage", character: Character.jaina, move: "up-tilt", facing: "left", slot: 1 });
  expect(captureRequest("-dev capture lich up-tilt left 1")).toEqual({ kind: "stage", character: Character.lich, move: "up-tilt", facing: "left", slot: 1 });
  expect(captureRequest("-dev capture blademaster forward-air left")).toEqual({ kind: "stage", character: Character.blademaster, move: "forward-air", facing: "left", slot: 0 });
  let staged = 0;
  for (const character of SELECTABLE_CHARACTERS) {
    for (const move of CAPTURE_MOVES) {
      const request = captureRequest(captureStageCommand(character, move.name, "left", 3));
      expect(request).toEqual({ kind: "stage", character, move: move.name, facing: "left", slot: 3 });
      const lane = createCaptureLane(character, move, -1, 3, 0);
      if (lane === undefined) continue;
      staged++;
      const stage = createCaptureStage();
      stage.lanes[3] = lane;
      const clips = new Set<string>();
      for (let frame = 0; frame < CAPTURE_MOVE_LIMIT + CAPTURE_HOLD_FRAMES + 2 && lane.loops === 0; frame++) {
        advanceCaptureStage(stage);
        clips.add(`${lane.pose.clipIndex ?? lane.pose.clipName}`);
        expect(lane.fighter.motion.x).toBe(CAPTURE_SLOT_X[3]);
      }
      expect(`${fighterSlug(character)} ${move.name} loops ${lane.loops}`).toBe(`${fighterSlug(character)} ${move.name} loops 1`);
      expect(clips.size).toBeGreaterThan(0);
      expect(captureStaged(stage)).toBe(true);
    }
  }
  expect(captureMove("forward-air")).toBeDefined();
  expect(createCaptureLane(Character.blademaster, captureMove("forward-air") ?? CAPTURE_MOVES[0]!, 1, 0, 0)).toBeDefined();
  expect(staged).toBeGreaterThan(SELECTABLE_CHARACTERS.length * 10);
});
