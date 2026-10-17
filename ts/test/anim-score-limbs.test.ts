import { expect, test } from 'bun:test';
import { lineOneRule } from '../scripts/wisp/animScore';
import { LIMB_STRIKES, skeletonOf } from '../scripts/wisp/animScoreSample';
import type { DrawnModel } from '../scripts/wisp/drawnModel';
import { Character } from '../src/game/sim/codes';

test("Anub'arak's claw rakes ride his Bone_Arm1 to Bone_ArmClaw chain and score line 1 on limb drive [k3 measure docs/animation-scorecard.md]", () => {
  const names = ['Bone_Root', 'Bone_Pelvis', 'Bone_Chest', 'Bone_Arm1R', 'Bone_Arm2R', 'Bone_Arm3R', 'Bone_ArmClawR', 'Bone_Arm1L', 'Bone_Arm2L', 'Bone_Arm3L', 'Bone_ArmClawL', 'Hand Right Ref', 'Hand Left Ref'];
  const crypt = { nodes: () => names.map((name) => ({ name, parent: undefined })) } as unknown as DrawnModel;
  const limbs = skeletonOf(crypt, Character.anubarak).limbs.map((limb) => [limb.name, names[limb.root], names[limb.end]]);
  expect(limbs).toEqual([['arm R', 'Bone_Arm1R', 'Bone_ArmClawR'], ['arm L', 'Bone_Arm1L', 'Bone_ArmClawL']]);
  const claw = skeletonOf(crypt, Character.anubarak).limbs[0];
  for (const move of ['forward-tilt', 'dash-attack', 'back-air', 'down-air']) expect(lineOneRule(LIMB_STRIKES["anub'arak"]?.includes(move) === true, claw)).toBe('limb');
});
