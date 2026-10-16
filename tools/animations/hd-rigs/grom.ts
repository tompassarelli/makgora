import { model as mdx } from '../../../ts/scripts/clipNodes';
import { generateModelMDX, parseModelMDX } from '../../../ts/scripts/mdxCodec';
export const character = 22;
export const stockPath = 'war3.w3mod:_de.w3mod:units\\orc\\Hellscream\\Hellscream.mdx';
export const classic = {
    root: 'Bone_Root',
    pelvis: 'Bone_Pelvis',
    chest: 'Bone_Chest',
    head: 'Bone_Head',
    'shoulder.L': 'Bone_Arm1_L',
    'elbow.L': 'Bone_Arm2_L',
    'wrist.L': 'Bone_Hand_L',
    'hip.L': 'Bone_Leg1_L',
    'knee.L': 'Bone_Leg2_L',
    'ankle.L': 'Bone_Foot_L',
    'shoulder.R': 'Bone_Arm1_R',
    'elbow.R': 'Bone_Arm2_R',
    'wrist.R': 'Bone_Hand_R',
    'hip.R': 'Bone_Leg1_R',
    'knee.R': 'Bone_Leg2_R',
    'ankle.R': 'Bone_Foot_R',
    weapon: 'Bone_Sword',
} as const;
export const pairs: readonly (readonly [string, string])[] = [
    ['root', 'bone_turret'], ['chest', 'bone_chest'], ['pelvis', 'pelvis_bind_jnt'],
    ['head', 'bone_head'],
    ['shoulder.L', 'L_upr_arm_bind_jnt'], ['elbow.L', 'L_lwr_arm_bind_jnt'], ['wrist.L', 'bone_hand_left'],
    ['shoulder.R', 'R_upr_arm_bind_jnt'], ['elbow.R', 'R_lwr_arm_bind_jnt'], ['wrist.R', 'bone_hand_right'],
    ['hip.L', 'L_leg_01_bind_jnt'], ['knee.L', 'L_leg_02_bind_jnt'], ['ankle.L', 'bone_leg_left'],
    ['hip.R', 'R_leg_01_bind_jnt'], ['knee.R', 'R_leg_02_bind_jnt'], ['ankle.R', 'bone_leg_right'],
    ['weapon', 'weapon_bind_jnt'], ['axe', 'weapon_stretch_bind_jnt'],
    ['Banner', 'flag_01_bind_jnt'], ['flag03', 'flag_02_bind_jnt'], ['flag02', 'flag_03_bind_jnt'], ['flag01', 'flag_04_bind_jnt'],
    ['Bone_Ponytai01', 'hair_tail_01_bind_jnt'], ['Bone_Ponytail', 'hair_tail_02_bind_jnt'],
];

const UP_SMASH = 'Grom upSmash', TURRET_DEGREES = 30, RISE = 13;
const UP_SMASH_KEYS: readonly (readonly [frame: number, amount: number])[] = [[0, 0], [10, -0.3], [13, 1], [17, 1], [42, 0]];

const turned = (quaternion: ArrayLike<number>, degrees: number) => {
    const half = degrees * Math.PI / 360, [x = 0, y = 0, z = 0, w = 1] = Array.from(quaternion), c = Math.cos(half), s = Math.sin(half);
    const out = [c * x + s * z, c * y + s * w, c * z - s * x, c * w - s * y], length = Math.hypot(...out);
    return new Float32Array(out.map(value => value / length));
};

export function definitiveFit(motion: mdx.Model, bytes: ArrayBuffer) {
    const interval = motion.Sequences.find(sequence => sequence.Name === UP_SMASH)?.Interval;
    if (interval === undefined) throw new Error(`Grom has no ${UP_SMASH} sequence`);
    const [first = 0, last = 0] = interval, model = parseModelMDX(bytes);
    const turret = model.Bones.find(node => node.Name === 'bone_turret'), chest = model.Bones.find(node => node.Name === 'bone_chest');
    if (turret?.Rotation === undefined || turret.Translation === undefined || chest?.Rotation === undefined) throw new Error('Grom Definitive body has no animated bone_turret and bone_chest');
    const outside = <K extends { Frame: number }>(keys: K[]) => keys.filter(key => key.Frame < first || key.Frame > last);
    const held = <K extends { Frame: number }>(keys: readonly K[], time: number) => keys.filter(key => key.Frame <= time).at(-1)!;
    const rotation = turret.Rotation.Keys.map(key => ({ ...key, Vector: key.Vector.slice() }));
    const chestRotation = chest.Rotation.Keys.map(key => ({ ...key, Vector: key.Vector.slice() }));
    const translation = turret.Translation.Keys.map(key => ({ ...key, Vector: key.Vector.slice() }));
    turret.Rotation.Keys = outside(rotation); chest.Rotation.Keys = outside(chestRotation); turret.Translation.Keys = outside(translation);
    for (const [frame, amount] of UP_SMASH_KEYS) {
        const time = first + (frame === 13 ? Math.floor(frame * 1000 / 60) : Math.round(frame * 1000 / 60));
        const root = held(rotation, time), rootVector = turned(root.Vector, TURRET_DEGREES * amount);
        turret.Rotation.Keys.push({ ...root, Frame: time, Vector: rootVector, ...(root.InTan ? { InTan: rootVector.slice(), OutTan: rootVector.slice() } : {}) });
        const pose = held(chestRotation, time), chestVector = turned(pose.Vector, 0);
        chest.Rotation.Keys.push({ ...pose, Frame: time, Vector: chestVector, ...(pose.InTan ? { InTan: chestVector.slice(), OutTan: chestVector.slice() } : {}) });
        const place = held(translation, time);
        turret.Translation.Keys.push({ ...place, Frame: time, Vector: new Float32Array([place.Vector[0]!, place.Vector[1]!, place.Vector[2]! + RISE * amount]) });
    }
    for (const keys of [turret.Rotation.Keys, chest.Rotation.Keys, turret.Translation.Keys]) keys.sort((a, b) => a.Frame - b.Frame);
    return { bytes: generateModelMDX(model), report: { upSmash: { turretDegrees: TURRET_DEGREES, rise: RISE } } };
}
