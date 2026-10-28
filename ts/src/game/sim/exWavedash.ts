import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "./fighter";
import { exCharged, spendEx } from "./meter";
import { melee } from "./tuning";

export const EX_WAVEDASH_SPEED = melee(f32(0.625));

export function landExWavedash(f: Fighter): void {
  const { dodge, motion } = f;
  if (motion.grounded) return;
  dodge.ex = dodge.airDodging && dodge.ex && motion.vx !== 0 && exCharged(f);
  if (!dodge.ex) return;
  spendEx(f);
  motion.vx = f32(motion.vx + (motion.vx > 0 ? EX_WAVEDASH_SPEED : -EX_WAVEDASH_SPEED));
}

export function settleExWavedash(f: Fighter, canSteer: boolean, direction: number): void {
  const { dodge, motion } = f;
  if (!dodge.ex || dodge.airDodging || f.jump.dodgeQueued) return;
  if (!motion.grounded || motion.vx === 0 || f.launch.hitstun > 0 || (f.landing.lag <= 0 && canSteer && direction !== 0)) dodge.ex = false;
}
