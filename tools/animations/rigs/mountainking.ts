export const character = 4;
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
    weapon: '1Cylinder04',
    'weapon.L': '1Cylinder03',
} as const;
export const pain = {
    rows: {
        low: { turn: { chest: 10, head: 15 } },
        middle: { turn: { pelvis: 20, chest: 65, head: 75 }, aim: { 'arm.weapon': 120, 'forearm.weapon': 60, 'arm.free': 120, 'forearm.free': 60 } },
        high: { aim: { 'arm.weapon': 250, 'forearm.weapon': 300 } },
    },
} as const;
