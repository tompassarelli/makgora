import { type Choice, type Pose, type Space, describe } from "../movement-space";

const turn = [-120, -90, -60, -30, 0, 30, 60, 90, 120];
const BONES = {
  neck: ["Bone Wolf Neck"], head: ["Bone Wolf Head"], waist: ["Bone Wolf Waist"],
  frontLeg: ["Bone Front L Leg", "Bone Front R Leg"], frontShin: ["Bone Front L Shin", "Bone_Mesh49"], frontToe: ["Bone FrontL Toe", "Bone_Mesh48"],
  backLeg: ["Bone Back L Leg", "Bone Back R Leg"], backShin: ["Bone Back L Shin", "Bone Back R Shin"], backToe: ["Bone Object67", "Bone Back R Toe"],
  tail: ["Bone Tail 1", "Bone Tail 2"], seat: ["Bone Rider Waist"], chest: ["Bone_Chest"], riderHead: ["Bone_Head"],
  rightArm: ["Bone Rider R Arm"], rightWrist: ["Bone Rider R Wrist"], leftArm: ["Bone Rider L Arm"], leftWrist: ["Bone Rider L Wrist"],
} as const;

const hang = (c: Choice) => ({
  name: describe(c), angles: {}, fold: 0, lean: c.lean ?? 0, parentFrame: c.frame === 1,
  bones: Object.fromEntries(Object.entries(BONES).flatMap(([key, names]) => names.map((name) => [name, c[key] ?? 0] as const))),
});

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  ledgeHang: {
    starts: [
      { frame: 1, lean: -110, neck: -30, head: 90, waist: 0, frontLeg: 30, frontShin: 30, frontToe: 60, backLeg: -90, backShin: -30, backToe: 0, tail: -60, seat: 60, chest: 0, riderHead: 0, rightArm: 0, rightWrist: 0, leftArm: 0, leftWrist: 0 },
    ],
    options: {
      frame: [0, 1], lean: [-110, -95, -80, -65, -50, -35], neck: turn, head: turn, waist: [-60, -30, 0, 30, 60], frontLeg: turn, frontShin: turn, frontToe: [-60, -30, 0, 30, 60],
      backLeg: turn, backShin: turn, backToe: [-60, -30, 0, 30, 60], tail: [-60, -30, 0, 30, 60], seat: turn, chest: turn, riderHead: [-60, -30, 0, 30, 60],
      rightArm: turn, rightWrist: [-60, -30, 0, 30, 60], leftArm: turn, leftWrist: [-60, -30, 0, 30, 60],
    },
    variant: hang,
    local: true,
  },
};
