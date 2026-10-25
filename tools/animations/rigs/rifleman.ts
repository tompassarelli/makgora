export const character = 1;
export const classic = {
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
    weapon: 'Rifle01',
} as const;
export const pain = {
    rows: {
        low: { turn: { pelvis: -15, chest: -30, head: 10, 'wrist.weapon': -180 }, aim: { 'arm.weapon': 240, 'forearm.weapon': 280, 'arm.free': 250, 'forearm.free': 290 } },
        high: { aim: { 'arm.weapon': 300, 'forearm.weapon': 320 } },
    },
} as const;
