export interface TrailerShot {
  readonly seed: number;
  readonly fighters: readonly [string, string];
  readonly stage: number;
  readonly start: number;
  readonly end: number;
}

export const TRAILER_SHOTS: readonly TrailerShot[] = [
  { seed: 34, fighters: ["shadow-hunter", "beastmaster"], stage: 6, start: 4679, end: 5011 },
  { seed: 44, fighters: ["goblin-tinker", "murloc"], stage: 13, start: 4293, end: 4758 },
  { seed: 54, fighters: ["blademaster", "lich"], stage: 11, start: 8381, end: 8769 },
  { seed: 99, fighters: ["grom-hellscream", "anub'arak"], stage: 3, start: 802, end: 1273 },
  { seed: 129, fighters: ["anub'arak", "warden"], stage: 14, start: 5713, end: 6133 },
  { seed: 179, fighters: ["malfurion-stormrage", "warden"], stage: 7, start: 3680, end: 3942 },
  { seed: 199, fighters: ["peon", "anub'arak"], stage: 12, start: 4393, end: 4671 },
  { seed: 204, fighters: ["kobold", "warden"], stage: 0, start: 1867, end: 2345 },
  { seed: 284, fighters: ["medivh", "pit-lord"], stage: 13, start: 4082, end: 4410 },
  { seed: 289, fighters: ["mountain-king", "cairne-bloodhoof"], stage: 1, start: 4241, end: 4659 },
  { seed: 344, fighters: ["forsaken-paladin", "murloc"], stage: 13, start: 144, end: 624 },
  { seed: 364, fighters: ["rifleman", "cairne-bloodhoof"], stage: 4, start: 997, end: 1237 },
  { seed: 389, fighters: ["anub'arak", "sylvanas-windrunner"], stage: 10, start: 5725, end: 5992 },
];
