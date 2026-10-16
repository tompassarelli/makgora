import { type Choice, type Pose, type Space, SPACES } from "../movement-space";

const CARAPACE = ["Bone_TopCarapaceL", "Bone_TopCarapaceR"];
const crouch = SPACES.crouch;
const authored = { frame: 1, hip: -115, knee: 140, chest: 76.25, shoulder: -100, elbow: -80, weapon: -60, carapace: -60, head: -110 };

export const MOVEMENT_POSES: Partial<Record<Pose, Space>> = {
  crouch: {
    starts: [{ ...authored, squash: 0.1 }, { ...authored, squash: 0.15 }],
    options: { ...crouch.options, carapace: [-90, -60, -30, 0], head: [-140, -110, -80, -50], squash: [0, 0.05, 0.1, 0.15] },
    variant: (c: Choice) => ({ ...crouch.variant(c), bones: Object.fromEntries(CARAPACE.map((bone) => [bone, c.carapace ?? 0])) }),
  },
};
