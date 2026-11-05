import { expect, test } from "bun:test";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { placedPieces } from "../src/game/presentation/stageScenery";
import { FROZEN_THRONE_STAGE } from "../src/game/sim/stage";
import { drawStageScenery } from "../src/host/loop/stageScenery";
import { testHeadless } from "./headless";


const headless = testHeadless(MAKGORA_HEADLESS);

test("the shell stops the animation of each still Frozen Throne piece the moment it places it and no other piece [k1 scenario]", () => {
  const client = headless.clients({ install: () => undefined, start: () => undefined }, [0]).client(0);
  const shell = { game: { stageChoice: FROZEN_THRONE_STAGE }, origin: { x: 0, y: 0, z: 0 }, stageDrifters: [], stageScenery: undefined, shadowLightsRaised: false };
  client.run(() => drawStageScenery(shell as never));

  const placed = placedPieces(FROZEN_THRONE_STAGE);
  const stills = placed.flatMap((piece, index) => (piece.still === true ? [index] : []));
  expect(stills.length).toBeGreaterThanOrEqual(10);
  const poses = client.effectPoses();
  expect(poses.map(pose => pose.model)).toEqual(placed.map(piece => piece.model));
  expect(poses.flatMap((pose, index) => (pose.timeScale === 0 ? [index] : []))).toEqual(stills);
});
