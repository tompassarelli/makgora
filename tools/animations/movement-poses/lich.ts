import type { Choice, Pose, Space } from "../movement-space";
import { SPACES } from "../movement-space";

const hang = SPACES.ledgeHang;

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  ledgeHang: {
    ...hang,
    starts: hang.starts.flatMap((start) => [0, 14].flatMap((drop) => [0, 8].map((back) => ({ ...start, drop, back })))),
    options: { ...hang.options, drop: [0, 7, 14, 21, 28], back: [0, 4, 8, 12, 16] },
    variant: (c: Choice) => ({ ...hang.variant(c), drop: c.drop ?? 0, back: c.back ?? 0 }),
  },
};
