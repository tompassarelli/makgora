import { type Pose, type Space, SPACES } from "../movement-space";

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  crouch: {
    ...SPACES.crouch,
    starts: [{ frame: 0, hip: -40, knee: 60, chest: 20, shoulder: -30, elbow: -40, weapon: 0, squash: 0.15 }, { frame: 1, hip: -60, knee: 80, chest: 30, shoulder: -30, elbow: -40, weapon: 0, squash: 0.15 }],
    options: { ...SPACES.crouch.options, hip: [-80, -60, -40, -20, 0], knee: [0, 30, 60, 80, 110] },
  },
};
