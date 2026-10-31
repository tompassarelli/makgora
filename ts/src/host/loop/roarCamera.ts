import { Phase } from "../../game/lobby/lobbyState";
import { roarShake } from "../../game/presentation/terrorCues";
import type { Roster } from "../../game/sim/roster";
import { setCameraField } from "wisp/game/view";

export function shakeRoarCamera(world: Roster, phase: Phase, paused: boolean, zOffset: number): void {
  const shake = phase === Phase.match && !paused ? roarShake(world) : 0.0;
  if (shake !== 0.0) setCameraField(CAMERA_FIELD_ZOFFSET, zOffset + shake, 0.0);
}
