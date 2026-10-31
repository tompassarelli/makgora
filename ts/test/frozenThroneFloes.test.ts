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
  expect(floes.length).toBeGreaterThanOrEqual(10);
  expect(floes.every(piece => piece.still === true)).toBe(true);
});

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

test("the Frozen Throne's stepped causeway of five still floes runs from the deck's back edge toward the dais, each step deeper and lower than the last, under a lifted dais [k2 property]", () => {
  const steps = placedPieces(FROZEN_THRONE_STAGE).filter(piece => piece.model === FLOE && piece.x === 0 && piece.y >= 1300 && piece.y < 1700).sort((a, b) => a.y - b.y);
  expect(steps.length).toBe(5);
  expect(steps.every(piece => piece.still === true)).toBe(true);
  for (let index = 1; index < steps.length; index += 1) {
    expect(steps[index]?.z ?? 0).toBeLessThan(steps[index - 1]?.z ?? 0);
    expect(steps[index]?.matrixScale?.[0] ?? 0).toBeGreaterThan(steps[index - 1]?.matrixScale?.[0] ?? 0);
  }
  expect(steps[0]?.y ?? 0).toBeLessThanOrEqual(1400);
  expect(steps[0]?.z ?? 0).toBeLessThanOrEqual(0);
  expect(steps[steps.length - 1]?.z ?? 0).toBeLessThanOrEqual(-200);
});
