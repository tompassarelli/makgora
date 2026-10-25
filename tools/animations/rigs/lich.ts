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
    rows: {
        low: { turn: { chest: -10, head: 10 }, drop: -14 },
    },
} as const;
