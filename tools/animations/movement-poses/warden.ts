import { type Pose, type Space, SPACES } from "../movement-space";

const hang = SPACES.ledgeHang;

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  ledgeHang: { ...hang, options: { ...hang.options, weapon: [0] } },
};
