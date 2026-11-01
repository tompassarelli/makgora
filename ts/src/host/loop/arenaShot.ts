import { ARENA_CAMERA, localCamera, resultCamera } from "../../game/presentation/arenaCamera";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { Phase } from "../../game/lobby/lobbyState";
import { isActive } from "../../game/sim/roster";
import { advancePauseCamera, pauseCameraAngle } from "./pauseCamera";
import { presentedMatch } from "./presentedMatch";
import type { ShellState } from "./state";
import { views } from "./ui";

/** Aims `s.camera` for the frame, as the live match, the pause orbit or the results shot, and returns the tilt the game camera should take: the results shot keeps the match's heading and tilt. */
export function aimArenaCamera(s: ShellState, aspect: number): number {
  const { world, game } = presentedMatch(s);
  const resultFrames = views(s).match.resultFrames;
  const live = game.camera.initialized ? game.camera : s.previewCamera;
  const angle = game.phase === Phase.match && s.session.paused ? pauseCameraAngle(s) : ARENA_CAMERA.angleOfAttack;
  if (game.phase !== Phase.result) {
    if (s.session.paused && s.pauseCamera !== undefined) advancePauseCamera(s, aspect);
    else localCamera(s.camera, live, game.stageChoice, aspect);
    return angle;
  }
  resultCamera(s.camera, game.stageChoice, aspect, resultFrames, PARTICIPANT_SLOTS.filter(slot => isActive(world, slot)).length);
  return angle;
}
