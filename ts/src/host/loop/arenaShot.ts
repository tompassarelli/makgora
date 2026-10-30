import { ARENA_CAMERA, localCamera, resultCamera } from "../../game/presentation/arenaCamera";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { Phase } from "../../game/lobby/lobbyState";
import { isActive } from "../../game/sim/roster";
import { KO_ZOOM_FRAMES, type OrbitView, finale, koZoomActive, orbitWinner, zoomOntoKo } from "./finale";
import { advancePauseCamera, pauseCameraAngle } from "./pauseCamera";
import { presentedMatch } from "./presentedMatch";
import type { ShellState } from "./state";
import { views } from "./ui";

/** Aims `s.camera` for the frame, as the live match, the pause orbit, the final KO's zoom or the results sweep, and returns the heading and tilt the game camera should take. */
export function aimArenaCamera(s: ShellState, aspect: number): OrbitView {
  const { world, game } = presentedMatch(s);
  const resultFrames = views(s).match.resultFrames;
  const live = game.camera.initialized ? game.camera : s.previewCamera;
  const orbit: OrbitView = { rotation: ARENA_CAMERA.rotation, angle: pauseCameraAngle(s) };
  if (game.phase !== Phase.result) {
    s.koZoom = undefined;
    if (s.session.paused && s.pauseCamera !== undefined) advancePauseCamera(s, aspect);
    else localCamera(s.camera, live, game.stageChoice, aspect);
    return orbit;
  }
  if (koZoomActive(s.koZoom, resultFrames)) {
    localCamera(s.camera, live, game.stageChoice, aspect);
    zoomOntoKo(s.camera, s.koZoom, resultFrames);
    return orbit;
  }
  const zoomed = finale.koZoom && s.koZoom !== undefined ? KO_ZOOM_FRAMES : 0;
  resultCamera(s.camera, game.stageChoice, aspect, resultFrames - zoomed, PARTICIPANT_SLOTS.filter(slot => isActive(world, slot)).length);
  const winnerX = views(s).match.winnerX();
  return winnerX === undefined ? orbit : orbitWinner(s.camera, winnerX, resultFrames, orbit.rotation, orbit.angle);
}
