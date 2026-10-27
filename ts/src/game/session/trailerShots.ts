export interface TrailerShot {
  readonly seed: number;
  readonly fighters: readonly [string, string];
  readonly stage: number;
  readonly start: number;
  readonly end: number;
}

export const TRAILER_SHOTS: readonly TrailerShot[] = [
  { seed: 19, fighters: ["kael'thas-sunstrider", "murloc"], stage: 12, start: 7624, end: 8040 },
  { seed: 154, fighters: ["medivh", "warden"], stage: 6, start: 4950, end: 5407 },
  { seed: 194, fighters: ["thrall", "murloc"], stage: 2, start: 261, end: 680 },
  { seed: 204, fighters: ["kobold", "warden"], stage: 0, start: 2399, end: 2786 },
  { seed: 224, fighters: ["chen-stormstout", "anub'arak"], stage: 13, start: 3254, end: 3618 },
  { seed: 234, fighters: ["rifleman", "beastmaster"], stage: 11, start: 3283, end: 3676 },
  { seed: 294, fighters: ["shadow-hunter", "murloc"], stage: 11, start: 3462, end: 3881 },
  { seed: 339, fighters: ["illidan", "cairne-bloodhoof"], stage: 3, start: 4723, end: 5169 },
  { seed: 349, fighters: ["lich-king", "anub'arak"], stage: 1, start: 1470, end: 1933 },
  { seed: 359, fighters: ["grom-hellscream", "pit-lord"], stage: 7, start: 5231, end: 5490 },
  { seed: 369, fighters: ["lich", "murloc"], stage: 14, start: 1248, end: 1608 },
  { seed: 389, fighters: ["anub'arak", "sylvanas-windrunner"], stage: 10, start: 1334, end: 1800 },
];
