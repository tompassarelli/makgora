export const LIMB_STRIKES: Readonly<Record<string, readonly string[]>> = {
  "shadow-hunter": ["jab", "forward-tilt", "forward-tilt-up", "forward-tilt-down", "up-tilt", "down-tilt", "dash-attack"],
  thrall: ["back-air", "down-tilt", "forward-tilt-down", "down-smash", "down-air", "dash-attack"],
  illidan: ["down-tilt", "down-smash", "down-air", "forward-smash"],
  warden: ["down-tilt", "down-smash", "down-air", "down-special"],
  "cairne-bloodhoof": ["down-special"],
  "anub'arak": ["forward-tilt", "forward-tilt-up", "forward-tilt-down", "down-tilt", "dash-attack", "forward-air", "back-air", "down-air"],
  "mountain-king": ["down-air"],
  dreadlord: ["forward-air", "back-air"],
  "chen-stormstout": ["jab", "jab3", "down-tilt", "dash-attack", "up-smash", "neutral-air", "forward-air", "back-air", "down-air"],
};

export const SPELL_STRIKES: Readonly<Record<string, readonly string[]>> = {
  "mountain-king": ["down-special", "ultimate"],
  thrall: ["neutral-special", "down-special"],
  medivh: ["side-special", "up-special", "down-special", "ultimate"],
  archimonde: ["neutral-special", "side-special", "up-special", "ultimate"],
  "chen-stormstout": ["neutral-special", "ultimate"],
  "pit-lord": ["neutral-special", "up-special"],
};
