import { f32 } from "wisp/src/sim/f32";
import { swingHead } from "./moves";
import { RISING_THUNDER, RISING_THUNDER_APEX, RISING_THUNDER_CAST, RISING_THUNDER_SWING } from "./risingThunder";

const CAST_ANGLE = -20.0;
const FALL_ANGLE = 40.0;

function hammerAngle(frame: number): number {
  const beats = RISING_THUNDER_SWING.beats;
  const first = beats[0];
  if (first === undefined || frame <= RISING_THUNDER_CAST) return CAST_ANGLE;
  if (frame < first.frame) return f32(CAST_ANGLE + f32(f32(first.angle - CAST_ANGLE) * f32((frame - RISING_THUNDER_CAST) / (first.frame - RISING_THUNDER_CAST))));
  for (let index = 1; index < beats.length; index++) {
    const from = beats[index - 1];
    const to = beats[index];
    if (from === undefined || to === undefined || frame > to.frame) continue;
    return f32(from.angle + f32(f32(to.angle - from.angle) * f32((frame - from.frame) / (to.frame - from.frame))));
  }
  if (frame <= RISING_THUNDER_APEX.last + 2) return 90.0;
  return f32(90.0 + f32(f32(FALL_ANGLE - 90.0) * f32((frame - RISING_THUNDER_APEX.last - 2) / (RISING_THUNDER.endFrame - RISING_THUNDER_APEX.last - 2))));
}

const HAMMER_HEAD = Array.from({ length: RISING_THUNDER.endFrame }, (_, index) => {
  const [x, z] = swingHead(RISING_THUNDER_SWING, hammerAngle(index + 1));
  return { x, z };
});

const PALM_HEAT = { model: "Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx", anchor: "feet" as const, scale: f32(0.9), sequence: "stand", seconds: f32(0.2), pitch: 0.0 };
export const RISING_THUNDER_ARCS_MODEL = "Abilities\\Spells\\Other\\ForkedLightning\\ForkedLightningTarget.mdx";
const HAMMER_ARCS = { model: RISING_THUNDER_ARCS_MODEL, anchor: "hand" as const, scale: f32(2.0), anchorFrames: HAMMER_HEAD, sound: "ThunderClap", birth: { eachFrame: true, voices: 24, lingerFrames: 30 } };

export const RISING_THUNDER_CUES = { spell: "Rising Thunder", startup: PALM_HEAT, active: HAMMER_ARCS, trail: true as const };
