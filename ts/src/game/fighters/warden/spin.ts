/**
 * Warden's neutral-air spin (#440): her body and blade turn one full circle in
 * the screen plane over the active frames, the tip leading from her facing,
 * over her head, behind her and under her. The animation tool reads this path.
 */

/** The tip's angle about the pivot, degrees counterclockwise from her facing with z up, `progress` frames into `active` active frames. */
export function wardenSpinTipDegrees(progress: number, active: number): number {
  return 360.0 * progress / active;
}
