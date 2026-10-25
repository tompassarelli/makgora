export const character = 12;
export const classic = {
    root: 'Root',
    pelvis: 'Stomach',
    chest: 'Chest',
    head: 'Head',
    'shoulder.L': 'Lshoulder',
    'elbow.L': 'Lelbow',
    'wrist.L': 'Lhand',
    'hip.L': 'Lhip',
    'knee.L': 'Lknee',
    'ankle.L': 'Lfoot',
    'shoulder.R': 'RShoulder',
    'elbow.R': 'Relbow',
    'wrist.R': 'Rhand',
    'hip.R': 'Rhip',
    'knee.R': 'Rknee',
    'ankle.R': 'Rfoot',
    weapon: 'Weapon',
} as const;
export const pain = {
    rows: {
        low: { turn: { "wrist.weapon": 90 }, aim: { "arm.weapon": 120, "arm.free": -60, "forearm.free": -30 } },
        middle: { turn: { "wrist.weapon": -110 }, aim: { "forearm.weapon": 200 } },
        high: { turn: { pelvis: -15, chest: -60, head: -50, "wrist.weapon": -90 }, aim: { "arm.weapon": -60, "forearm.weapon": -10 } },
    },
} as const;
