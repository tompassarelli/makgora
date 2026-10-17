import { type Choice, type Pose, type Space, SPACES } from "../movement-space";

const LEFT_ARM = { Bone_Arm1_L: "shoulderL", Bone_Arm2_L: "elbowL", "1Cylinder03": "weaponL" } as const;
const crouch = SPACES.crouch, hang = SPACES.ledgeHang;
const swing = [-120, -90, -60, -30, 0, 30, 60, 90, 120];
export const GRIP_BONES = ["1Cylinder04"];

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  crouch: {
    starts: [
      { frame: 1, hip: -80, knee: 110, chest: 30, shoulder: -30, elbow: -40, weapon: 0, shoulderL: 30, elbowL: -40, weaponL: 0 },
      { frame: 1, hip: -115, knee: 140, chest: 20, shoulder: -30, elbow: -40, weapon: 0, shoulderL: 60, elbowL: 0, weaponL: -60 },
    ],
    options: { ...crouch.options, chest: [10, 20, 30, 40], shoulderL: [-30, 0, 30, 60, 90, 120, 150], elbowL: [-80, -40, 0, 40], weaponL: [-90, -60, -30, 0, 30] },
    variant: (c: Choice) => ({ ...crouch.variant(c), bones: Object.fromEntries(Object.entries(LEFT_ARM).map(([bone, key]) => [bone, c[key] ?? 0])) }),
  },
  ledgeHang: {
    starts: hang.starts.map((start) => ({ ...start, weaponL: 0 })),
    options: { ...hang.options, weapon: swing, weaponL: swing },
    variant: (c: Choice) => ({ ...hang.variant(c), bones: { "1Cylinder03": c.weaponL ?? 0 } }),
    randomStarts: 10,
  },
};
