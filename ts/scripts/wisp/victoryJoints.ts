import type { model as mdx } from 'war3-model';

export type Side = 0 | 1;
export type Limb = 'shoulder' | 'elbow' | 'hand';

const BODY = {
    root: ['Bone_Root', 'Bone_Root01', 'Root', 'local_C0_0_jnt'],
    pelvis: ['Bone_Pelvis', 'spine_C0_0_jnt', 'Bone_Root01', 'Bone_Root', 'Root'],
    waist: ['Bone_Waist', 'spine_C0_1_jnt', 'Stomach'],
    chest: ['Bone_Chest', 'Bone_Chest01', 'bone_chest', 'Chest', 'Cylinder01'],
    head: ['Bone_Head', 'Bone_Head01', 'bone_head', 'Head'],
} as const;

const LIMBS: Readonly<Record<Limb, readonly [readonly string[], readonly string[]]>> = {
    shoulder: [
        ['Bone_Arm1_R', 'Bone_Arm1_R01', 'Bone_UpperArmR', 'Bone_Arm1R', 'arm_R0_0_jnt', 'RShoulder', 'Cylinder06'],
        ['Bone_Arm1_L', 'Bone_Arm1_L01', 'Bone_UpperArmL', 'Bone_Arm1L', 'arm_L0_0_jnt', 'Lshoulder', 'Cylinder07'],
    ],
    elbow: [
        ['Bone_Arm2_R', 'Bone_Arm2_R01', 'Bone_LowerArmR', 'Bone_Arm2R', 'arm_R0_2_jnt', 'Relbow', 'Mesh04'],
        ['Bone_Arm2_L', 'Bone_Arm2_L01', 'Bone_LowerArmL', 'Bone_Arm2L', 'arm_L0_2_jnt', 'Lelbow', 'Mesh05'],
    ],
    hand: [
        ['Bone_Hand_R', 'Bone_Hand_R01', 'Bone_HandR', 'arm_R0_end_jnt', 'Rhand', 'Hand Right Ref ', 'Hand Right Ref', 'Mesh02'],
        ['Bone_Hand_L', 'Bone_Hand_L01', 'Bone_HandL', 'arm_L0_end_jnt', 'Lhand', 'Hand Left Ref ', 'Hand Left Ref', 'Mesh03'],
    ],
};

const FOLLOWERS: readonly (readonly [readonly string[], Side])[] = [[['Bone_Axe_Free', 'Wep01_R0_0_jnt', 'Rifle01'], 0], [['book_C0_0_jnt'], 1]];

function find(model: mdx.Model, names: readonly string[]): mdx.Node | undefined {
    for (const wanted of names) {
        const found = model.Nodes.find(candidate => candidate?.Name === wanted);
        if (found !== undefined) return found;
    }
    return undefined;
}

export function bodyJoint(model: mdx.Model, role: keyof typeof BODY): mdx.Node | undefined { return find(model, BODY[role]); }
export function limbJoint(model: mdx.Model, limb: Limb, side: Side): mdx.Node | undefined { return find(model, LIMBS[limb][side]); }
export function followers(model: mdx.Model): readonly { readonly node: mdx.Node; readonly side: Side }[] {
    return FOLLOWERS.flatMap(([names, side]) => { const node = find(model, names); return node === undefined ? [] : [{ node, side }]; });
}
