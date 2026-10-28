import { f32 } from "wisp/src/sim/f32";

export const EYE_BEAM_GROUND_SHOT = 23;
export const EYE_BEAM_GROUND_FRAMES = 57;
export const EYE_BEAM_AIR_SHOT = 13;
export const EYE_BEAM_AIR_FRAMES = 42;
export const EYE_BEAM_LANDING_LAG = 0;
export const EYE_BEAM_AIR_FORM = 2;
export const EYE_BEAM_SPEED = 48.0;
export const EYE_BEAM_LIFETIME = 15;
export const EYE_BEAM_REACH = EYE_BEAM_SPEED * EYE_BEAM_LIFETIME;
export const EYE_BEAM_EYE_HEIGHT = 140.0;
export const EYE_BEAM_DAMAGE = 3.0;
export const EYE_BEAM_SET_KNOCKBACK = 5.0;
export const EYE_BEAM_BAND_BELOW = 80.0;
export const EYE_BEAM_BAND_ABOVE = 20.0;
export const EYE_BEAM_BAND_HALF = f32((EYE_BEAM_BAND_BELOW + EYE_BEAM_BAND_ABOVE) * 0.5);
export const EYE_BEAM_BAND_DROP = f32(EYE_BEAM_BAND_BELOW - EYE_BEAM_BAND_HALF);

export function eyeBeamShotFrame(form: number): number {
  return form === EYE_BEAM_AIR_FORM ? EYE_BEAM_AIR_SHOT : EYE_BEAM_GROUND_SHOT;
}

export function eyeBeamShotFrameWhen(grounded: boolean): number {
  return eyeBeamShotFrame(grounded ? 0 : EYE_BEAM_AIR_FORM);
}
