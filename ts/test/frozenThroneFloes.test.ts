import { expect, test } from "bun:test";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { placedPieces } from "../src/game/presentation/stageScenery";
import { FROZEN_THRONE_STAGE } from "../src/game/sim/stage";
import { drawStageScenery } from "../src/host/loop/stageScenery";
import { testHeadless } from "./headless";

const FLOE = "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("every ice floe of the Frozen Throne spire and stair is placed still [k2 property]", () => {
  const floes = placedPieces(FROZEN_THRONE_STAGE).filter(piece => piece.model === FLOE);
  expect(floes.length).toBeGreaterThanOrEqual(15);
  expect(floes.every(piece => piece.still === true)).toBe(true);
});

test("the shell stops the animation of each still Frozen Throne piece the moment it places it and no other piece [k1 scenario]", () => {
  const client = headless.clients({ install: () => undefined, start: () => undefined }, [0]).client(0);
  const shell = { game: { stageChoice: FROZEN_THRONE_STAGE }, origin: { x: 0, y: 0, z: 0 }, stageDrifters: [], stageScenery: undefined, shadowLightsRaised: false };
  client.run(() => drawStageScenery(shell as never));

  const placed = placedPieces(FROZEN_THRONE_STAGE);
  const stills = placed.flatMap((piece, index) => (piece.still === true ? [index] : []));
  expect(stills.length).toBeGreaterThanOrEqual(15);
  const poses = client.effectPoses();
  expect(poses.map(pose => pose.model)).toEqual(placed.map(piece => piece.model));
  expect(poses.flatMap((pose, index) => (pose.timeScale === 0 ? [index] : []))).toEqual(stills);
});
