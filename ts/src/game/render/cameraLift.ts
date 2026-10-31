import { ARENA_CAMERA } from "../presentation/arenaCamera";
import { cosineTurns, sineTurns } from "../sim/mathTables";
import { cameraField, cameraTargetX } from "wisp/game/view";

export interface CameraLift {
  readonly eyeX: number;
  readonly eyeZ: number;
  readonly lift: number;
  readonly front: number;
}


export function cameraLift(front: number): CameraLift {
  const pitch = ARENA_CAMERA.angleOfAttack / 360.0, yaw = ARENA_CAMERA.rotation / 360.0;
  const distance = cameraField(CAMERA_FIELD_TARGET_DISTANCE);
  const eyeX = cameraTargetX() - cosineTurns(yaw) * cosineTurns(pitch) * distance;
  const eyeZ = cameraField(CAMERA_FIELD_ZOFFSET) - sineTurns(pitch) * distance;
  const toward = sineTurns(yaw) * cosineTurns(pitch) * distance;
  const lift = toward > front * 2.0 ? front / toward : 0.0;
  return { eyeX, eyeZ, lift, front: lift > 0.0 ? front : 0.0 };
}
