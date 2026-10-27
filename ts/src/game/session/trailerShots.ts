export interface TrailerShot {
  readonly seed: number;
  readonly fighters: readonly [string, string];
  readonly stage: number;
  readonly start: number;
  readonly end: number;
}

export const TRAILER_SHOTS: readonly TrailerShot[] = [
  { seed: 29, fighters: ["mountain-king", "lich"], stage: 10, start: 1430, end: 1907 },
  { seed: 34, fighters: ["shadow-hunter", "beastmaster"], stage: 6, start: 5273, end: 5621 },
  { seed: 204, fighters: ["kobold", "warden"], stage: 0, start: 619, end: 1024 },
  { seed: 224, fighters: ["chen-stormstout", "anub'arak"], stage: 13, start: 2921, end: 3304 },
  { seed: 279, fighters: ["kael'thas-sunstrider", "warden"], stage: 3, start: 2750, end: 3187 },
  { seed: 304, fighters: ["goblin-tinker", "warden"], stage: 4, start: 3140, end: 3485 },
  { seed: 314, fighters: ["blademaster", "cairne-bloodhoof"], stage: 2, start: 2967, end: 3393 },
  { seed: 349, fighters: ["lich-king", "anub'arak"], stage: 1, start: 1470, end: 1933 },
  { seed: 359, fighters: ["grom-hellscream", "pit-lord"], stage: 7, start: 6321, end: 6788 },
  { seed: 369, fighters: ["lich", "murloc"], stage: 14, start: 1248, end: 1608 },
  { seed: 389, fighters: ["anub'arak", "sylvanas-windrunner"], stage: 10, start: 1334, end: 1800 },
];
