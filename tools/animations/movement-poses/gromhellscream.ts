import { type Choice, type Pose, type Space, SPACES } from "../movement-space";

const hang = SPACES.ledgeHang;

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  ledgeHang: {
    ...hang,
    options: { ...hang.options, drop: [0, 5, 10, 15, 20, 25], back: [0, 2, 4, 6, 8] },
    variant: (c: Choice) => ({ ...hang.variant(c), drop: c.drop ?? 0, back: c.back ?? 0 }),
  },
};
