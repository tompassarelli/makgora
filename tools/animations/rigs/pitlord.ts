export const character = 10;
export const classic = {
    pelvis: 'Bone Koto Waist01',
    chest: 'Bone_Chest',
    head: 'Bone_Head',
    'shoulder.L': 'Bone_Arm1_L',
    'elbow.L': 'Bone_Arm2_L',
    'wrist.L': 'Bone_Hand_L',
    'shoulder.R': 'Bone_Arm1_R',
    'elbow.R': 'Bone_Arm2_R',
    'wrist.R': 'Bone_Hand_R',
    weapon: 'Real BLADE',
} as const;
export const pain = {
    segments: [
        { node: 'Bone Front L Leg01', child: 'Bone Front L Shin01', limb: 'thigh.front' },
        { node: 'Bone Front L Shin01', child: 'Bone FrontL Toe01', limb: 'shin.front' },
        { node: 'Bone Front R Leg01', child: 'Bone Front R Shin01', limb: 'thigh.front' },
        { node: 'Bone Front R Shin01', child: 'Bone Front R Toe01', limb: 'shin.front' },
        { node: 'Bone Back L Leg01', child: 'Bone Back L Shin01', limb: 'thigh.back' },
        { node: 'Bone Back L Shin01', child: 'Bone Toe L ', limb: 'shin.back' },
        { node: 'Bone Back R Leg01', child: 'Bone Back R Shin01', limb: 'thigh.back' },
        { node: 'Bone Back R Shin01', child: 'Bone Toe R', limb: 'shin.back' },
    ],
    rows: {
        low: { aim: { 'arm.weapon': 110, 'forearm.weapon': 45 } },
        middle: { aim: { 'arm.weapon': 130, 'forearm.weapon': 80 } },
        high: { aim: { 'arm.weapon': 300, 'forearm.weapon': 0 } },
    },
} as const;
