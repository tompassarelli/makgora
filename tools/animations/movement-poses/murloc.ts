import { type Choice, type Pose, type Space, SPACES } from "../movement-space";

const hang = SPACES.ledgeHang;
const swing = [-200, -170, -140, -110, -80, -50, -20, 10, 40, 70];
const bend = [-90, -60, -30, 0, 30, 60, 90];

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  ledgeHang: {
    starts: [
      { frame: 1, shoulder: -140, elbow: 52.5, chest: 15, hip: -25, knee: -22.5, lean: -2.5, shoulderR: -140, elbowR: 52.5, wristR: 0 },
      { frame: 1, shoulder: -140, elbow: 52.5, chest: 15, hip: -25, knee: -22.5, lean: -2.5, shoulderR: -20, elbowR: 0, wristR: 0 },
      ...hang.starts.map((start) => ({ ...start, shoulderR: -20, elbowR: 0, wristR: 0 })),
    ],
    options: { ...hang.options, shoulderR: swing, elbowR: bend, wristR: bend },
    variant: (c: Choice) => ({ ...hang.variant(c), bones: { Bone_Arm1_R: c.shoulderR ?? 0, Bone_Arm2_R: c.elbowR ?? 0, Bone_Hand_R: c.wristR ?? 0 } }),
    randomStarts: 6,
  },
};
