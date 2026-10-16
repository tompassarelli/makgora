import type { Choice, Pose, Space } from "../movement-space";
import { SPACES } from "../movement-space";

const hang = SPACES.ledgeHang;

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  ledgeHang: {
    ...hang,
    starts: hang.starts.flatMap((start) => [0, 90, -90, 180].flatMap((weapon) => [{ ...start, weapon, drop: 14, back: 6, shoulderL: start.shoulder ?? 0, elbowL: start.elbow ?? 0 }, { ...start, weapon, drop: 14, back: 6, shoulderL: -30, elbowL: 0 }])),
    options: { ...hang.options, weapon: [-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180], drop: [0, 7, 14, 21, 28], back: [0, 4, 8, 12, 16],
      shoulderL: [-200, -170, -140, -110, -80, -50, -20, 10, 40], elbowL: [-90, -60, -30, 0, 30, 60] },
    variant: (c: Choice) => ({ ...hang.variant(c), drop: c.drop ?? 0, back: c.back ?? 0, bones: { Bone_Arm1_L: c.shoulderL ?? 0, Bone_Arm2_L: c.elbowL ?? 0 } }),
  },
};
