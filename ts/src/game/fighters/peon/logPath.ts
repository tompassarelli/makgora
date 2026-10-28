import { frames } from "../../sim/specials/schema";

export const LOG_LENGTH = 156.0;
export const LOG_LYING_HEIGHT = 20.0;
export const LOG_GRIP = frames(6, 26);

export interface LogKey {
  readonly frame: number;
  readonly x: number;
  readonly z: number;
  readonly angle: number;
}

const key = (frame: number, x: number, z: number, angle: number): LogKey => ({ frame, x, z, angle });

export const LOG_PATH: readonly LogKey[] = [
  key(0, 11.0, LOG_LYING_HEIGHT, 0.0), key(12, 11.0, LOG_LYING_HEIGHT, 0.0), key(13, 12.0, 25.0, -2.0), key(14, 17.0, 40.0, -6.5), key(15, 16.0, 63.0, 4.5),
  key(16, 0.0, 83.0, 30.0), key(17, -18.0, 80.0, 55.0), key(18, -14.0, 79.0, 85.0), key(19, -9.0, 77.0, 125.0), key(20, -8.0, 76.0, 168.0), key(25, -9.0, 76.0, 168.0),
  key(26, -8.0, 79.0, 176.0), key(27, -10.0, 50.0, 186.0), key(28, -12.0, 28.0, 181.0), key(29, -14.0, LOG_LYING_HEIGHT, 180.0), key(30, -14.0, LOG_LYING_HEIGHT, 180.0),
];
