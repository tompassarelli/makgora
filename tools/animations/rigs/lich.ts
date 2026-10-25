export const character = 6;
export const classic = {
    root: 'Bone_Root',
    chest: 'Cylinder01',
    neck: 'Bone NECK',
    head: 'Bone_Head',
    'shoulder.L': 'Cylinder07',
    'elbow.L': 'Mesh05',
    'wrist.L': 'Mesh03',
    'shoulder.R': 'Cylinder06',
    'elbow.R': 'Mesh04',
    'wrist.R': 'Mesh02',
} as const;
export const pain = {
    segments: [{ node: 'Cylinder03', child: 'Cylinder04', limb: 'thigh.front' }],
    rows: {
        low: { turn: { chest: -35, head: 20 }, aim: { 'thigh.front': 18, 'arm.weapon': 200, 'forearm.weapon': 225, 'arm.free': 215, 'forearm.free': 240 }, drop: -24 },
        middle: { aim: { 'thigh.front': 347 } },
        high: { aim: { 'thigh.front': 347 } },
    },
} as const;
