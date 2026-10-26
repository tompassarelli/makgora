/** The map build profiles: project.ts gives each its tsconfig, and wisp.ts's usage lists them without loading the build modules. */
export const profiles = ["main", "integrity", "pause-probe", "playable", "soak-playable", "soak-integrity", "native-input", "analog-keys", "analog-cursor", "native-perf", "census", "frame-cost", "stack-trace", "damage-blend-probe", "native-driver", "native-capture", "voice-check", "trailer", "showcase"] as const;
export type Profile = (typeof profiles)[number];
