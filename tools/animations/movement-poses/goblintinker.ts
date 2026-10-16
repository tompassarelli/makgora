import { type Choice, type Pose, type Space, describe } from "../movement-space";

const turn = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
export const GRIP_BONES = ["Bone_BackPack_Claw1Right", "Bone_BackPack_Claw2Right", "Bone_BackPack_Claw1Left", "Bone_BackPack_Claw2Left"];

const hang = (c: Choice) => ({
  name: describe(c), fold: 30, lean: c.lean ?? 0, parentFrame: c.frame === 1,
  angles: { shoulder: c.shoulder ?? 0, elbow: c.elbow ?? 0, chest: c.chest ?? 0, head: c.head ?? 0, hip: c.hip ?? 0, knee: c.knee ?? 0, ankle: -((c.hip ?? 0) + (c.knee ?? 0)) },
  bones: {
    Bone_BackPack_ArmRight1: c.packRight ?? 0, Bone_BackPack_ArmRight2: c.packElbowRight ?? 0, Bone_BackPack_ArmRight3: c.packWristRight ?? 0,
    Bone_BackPack_ArmLeft1: c.packLeft ?? 0, Bone_BackPack_ArmLeft2: c.packElbowLeft ?? 0, Bone_BackPack_ArmLeft3: c.packWristLeft ?? 0,
  },
});

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  ledgeHang: {
    starts: [
      { frame: 0, shoulder: -90, elbow: 0, chest: 0, head: 0, hip: 20, knee: 40, lean: 0, packRight: 30, packElbowRight: 30, packWristRight: 0, packLeft: 30, packElbowLeft: 30, packWristLeft: 0 },
      { frame: 1, shoulder: -150, elbow: -30, chest: 10, head: -15, hip: -20, knee: 90, lean: 0, packRight: -60, packElbowRight: 0, packWristRight: 0, packLeft: -60, packElbowLeft: 0, packWristLeft: 0 },
    ],
    options: {
      frame: [0, 1], shoulder: [-180, -150, -120, -90, -60, -30, 0], elbow: [-60, -30, 0, 30, 60], chest: [-30, -15, 0, 15, 30], head: [-45, -30, -15, 0, 15, 30], hip: [-60, -30, 0, 30, 60], knee: [0, 40, 80, 120], lean: [-30, -15, 0, 15, 30],
      packRight: turn, packElbowRight: turn, packWristRight: [-60, -30, 0, 30, 60], packLeft: turn, packElbowLeft: turn, packWristLeft: [-60, -30, 0, 30, 60],
    },
    variant: hang,
    randomStarts: 8,
  },
};
