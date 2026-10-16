import { type Choice, type Pose, type Space, SPACES } from "../movement-space";

const CARAPACE = ["Bone_TopCarapaceL", "Bone_TopCarapaceR"];
const REAR = ["Bone_RearCarapaceL", "Bone_RearCarapaceR"];
const CLAW = ["Bone_ArmClawL", "Bone_ArmClawR"];
const crouch = SPACES.crouch, hang = SPACES.ledgeHang;
const authored = { frame: 1, hip: -115, knee: 140, chest: 76.25, shoulder: -100, elbow: -80, weapon: -60, carapace: -60, head: -110 };
const turn = [-120, -90, -60, -30, 0, 30, 60, 90, 120];

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  crouch: {
    starts: [{ ...authored, squash: 0.1 }, { ...authored, squash: 0.15 }],
    options: { ...crouch.options, carapace: [-90, -60, -30, 0], head: [-140, -110, -80, -50], squash: [0, 0.05, 0.1, 0.15] },
    variant: (c: Choice) => ({ ...crouch.variant(c), bones: Object.fromEntries(CARAPACE.map((bone) => [bone, c.carapace ?? 0])) }),
  },
  ledgeHang: {
    starts: [...hang.starts.map((start) => ({ ...start, carapace: 0, rear: 0, claw: 0 })), ...hang.starts.map((start) => ({ ...start, carapace: -60, rear: -60, claw: -30 }))],
    options: { ...hang.options, carapace: turn, rear: turn, claw: turn },
    variant: (c: Choice) => ({ ...hang.variant(c), bones: Object.fromEntries([...CARAPACE.map((bone) => [bone, c.carapace ?? 0]), ...REAR.map((bone) => [bone, c.rear ?? 0]), ...CLAW.map((bone) => [bone, c.claw ?? 0])]) }),
  },
};
