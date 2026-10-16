export interface Variant {
  readonly name: string;
  readonly angles: Readonly<Record<string, number>>;
  readonly bones?: Readonly<Record<string, number>>;
  readonly fold: number;
  readonly lean: number;
  readonly squash?: number;
  readonly parentFrame: boolean;
}
export type Pose = "crouch" | "ledgeHang";
export type Choice = Readonly<Record<string, number>>;
export interface Space {
  readonly starts: readonly Choice[];
  readonly options: Readonly<Record<string, readonly number[]>>;
  readonly variant: (choice: Choice) => Variant;
  readonly randomStarts?: number;
  readonly local?: boolean;
}

export const describe = (choice: Choice) => Object.entries(choice).map(([key, value]) => `${key} ${value}`).join(" ");
export const SPACES: Readonly<Record<Pose, Space>> = {
  crouch: {
    starts: [{ frame: 0, hip: -80, knee: 110, chest: 35, shoulder: -30, elbow: -40, weapon: 0 }, { frame: 1, hip: -115, knee: 140, chest: 65, shoulder: -70, elbow: -80, weapon: -60 }],
    options: { frame: [0, 1], hip: [-115, -100, -80, -60], knee: [80, 110, 140], chest: [20, 35, 50, 65, 80], shoulder: [-110, -70, -30, 10, 50], elbow: [-80, -40, 0, 40], weapon: [-60, 0, 60] },
    variant: (c) => ({ name: describe(c), fold: 40 + (c.chest ?? 0) * 0.3, lean: c.lean ?? 0, squash: c.squash ?? 0, parentFrame: c.frame === 1,
      angles: { hip: c.hip ?? 0, knee: c.knee ?? 0, ankle: -((c.hip ?? 0) + (c.knee ?? 0)), chest: c.chest ?? 0, head: c.head ?? -(c.chest ?? 0) * 0.6, shoulder: c.shoulder ?? 0, elbow: c.elbow ?? -40, weapon: c.weapon ?? 0, pelvis: c.pelvis ?? 0 } }),
  },
  ledgeHang: {
    starts: [{ frame: 0, shoulder: -165, elbow: -20, chest: 5, hip: -30, knee: 60, lean: 0 }, { frame: 0, shoulder: -150, elbow: -60, chest: 25, hip: -100, knee: 140, lean: 0 }],
    options: { frame: [0, 1], shoulder: [-200, -185, -170, -155, -140, -125], elbow: [-90, -60, -30, 0, 30], chest: [-15, 5, 25], hip: [-120, -100, -70, -40, -10, 20], knee: [0, 40, 80, 110, 140], lean: [-70, -50, -35, -20, -10, 0, 10, 20, 35, 50, 70], weapon: [-60, 0, 60], tail: [-90, -60, -30, 0, 30, 60, 90], fold: [0, 30, 60, 90] },
    variant: (c) => ({ name: describe(c), fold: c.fold ?? 30, lean: c.lean ?? 0, parentFrame: c.frame === 1,
      angles: { shoulder: c.shoulder ?? 0, elbow: c.elbow ?? 0, chest: c.chest ?? 0, head: c.head ?? -15, hip: c.hip ?? 0, knee: c.knee ?? 0, ankle: -((c.hip ?? 0) + (c.knee ?? 0)), weapon: c.weapon ?? 0, pelvis: c.pelvis ?? 0, tail: c.tail ?? 0 } }),
  },
};
