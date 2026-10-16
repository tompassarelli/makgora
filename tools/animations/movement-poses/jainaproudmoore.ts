import type { Choice, Pose, Space } from "../movement-space";
import { SPACES } from "../movement-space";

const hang = SPACES.ledgeHang;

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  ledgeHang: {
    ...hang,
    starts: [0, 45, -45, 90, -90, 135, -135].map((weapon) => ({ frame: 0, shoulder: -170, elbow: 0, chest: 5, hip: -30, knee: 60, lean: 0, weapon, drop: 14 })),
    options: { ...hang.options, weapon: [-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180], drop: [0, 7, 14, 21, 28] },
    variant: (c: Choice) => ({ ...hang.variant(c), drop: c.drop ?? 0 }),
  },
};
