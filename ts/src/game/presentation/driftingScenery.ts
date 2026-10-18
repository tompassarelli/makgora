import { sineTurns } from "../sim/mathTables";

export interface DriftingPiece {
  readonly model: string;
  readonly fromX: number;
  readonly toX: number;
  readonly y: number;
  readonly z: number;
  readonly bob: number;
  readonly bobs: number;
  readonly scale: number;
  readonly seconds: number;
  readonly offset: number;
  readonly color?: readonly [number, number, number];
}

export interface DriftPose { x: number; z: number; yaw: number }

const pose: DriftPose = { x: 0.0, z: 0.0, yaw: 0.0 };

export function driftPose(piece: DriftingPiece, seconds: number): Readonly<DriftPose> {
  const turns = seconds / piece.seconds + piece.offset;
  const phase = turns - Math.floor(turns);
  pose.x = piece.fromX + (piece.toX - piece.fromX) * phase;
  pose.z = piece.z + piece.bob * sineTurns(phase * piece.bobs);
  pose.yaw = piece.toX >= piece.fromX ? 0.0 : Math.PI;
  return pose;
}
