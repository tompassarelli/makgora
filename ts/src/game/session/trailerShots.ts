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
  { seed: 49, fighters: ["malfurion-stormrage", "anub'arak"], stage: 1, start: 3888, end: 4218 },
  { seed: 54, fighters: ["blademaster", "lich"], stage: 11, start: 8609, end: 9013 },
  { seed: 64, fighters: ["thrall", "cairne-bloodhoof"], stage: 4, start: 650, end: 1004 },
  { seed: 69, fighters: ["peon", "murloc"], stage: 14, start: 5033, end: 5490 },
  { seed: 204, fighters: ["kobold", "warden"], stage: 0, start: 619, end: 1024 },
  { seed: 224, fighters: ["chen-stormstout", "anub'arak"], stage: 13, start: 2921, end: 3304 },
  { seed: 279, fighters: ["kael'thas-sunstrider", "warden"], stage: 3, start: 2750, end: 3187 },
  { seed: 359, fighters: ["grom-hellscream", "pit-lord"], stage: 7, start: 6321, end: 6788 },
  { seed: 389, fighters: ["anub'arak", "sylvanas-windrunner"], stage: 10, start: 1334, end: 1800 },
];
