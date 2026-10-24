import { MATCH_TICKS_PER_SECOND } from "../src/game/lobby/lobbyState";
import { extremeCamera } from "../src/game/presentation/arenaCamera";
import { createMatchCamera, MATCH_CAMERA_ASPECT } from "../src/game/sim/matchCamera";
import { FROZEN_THRONE_STAGE } from "../src/game/sim/stage";
import { JUDGE_CAMERA } from "./wisp/animJudgeCamera";
import { median } from "./wisp/animJudgeIdentity";
import { type ComputerMatch, playComputerMatch } from "./computerMatch";

export const FRAMING_MATCH: ComputerMatch = { fighters: ["thrall", "cairne-bloodhoof"], stage: FROZEN_THRONE_STAGE, shift: 0.0, stocks: 3, minutes: 7, frameLimit: 7 * 60 * MATCH_TICKS_PER_SECOND, seed: 1 };

export function measureMatchFraming(scenario: ComputerMatch = FRAMING_MATCH) {
  const distances: number[] = [];
  const tangents: number[] = [];
  playComputerMatch(scenario, ({ camera }) => {
    if (!camera.initialized) return;
    distances.push(camera.distance);
    tangents.push(camera.tangent);
  });
  const far = createMatchCamera();
  extremeCamera(far, scenario.stage, MATCH_CAMERA_ASPECT, "far");
  const distance = median(distances), tangent = median(tangents);
  return { frames: distances.length, distance, tangent, farDistance: far.distance, farTangent: far.tangent, scale: (far.distance * far.tangent) / (distance * tangent) };
}

if (import.meta.main) {
  const framing = measureMatchFraming();
  console.log(`${FRAMING_MATCH.fighters.join(" vs ")} on stage ${FRAMING_MATCH.stage}, seed ${FRAMING_MATCH.seed}: ${framing.frames} camera frames`);
  console.log(`median camera distance ${framing.distance} at tangent ${framing.tangent}`);
  console.log(`widest framing distance ${framing.farDistance.toFixed(1)} at tangent ${framing.farTangent.toFixed(4)}`);
  console.log(`a fighter draws ${framing.scale.toFixed(3)}x larger at the median than at the widest framing`);
  console.log(`judge strips render at distance ${JUDGE_CAMERA.distance}, tangent ${JUDGE_CAMERA.tangent}`);
}
