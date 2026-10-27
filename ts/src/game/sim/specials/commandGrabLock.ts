import type { Fighter } from "../fighter";
import type { AuthoredSpecial } from "./schema";

/** A caught command grab ends on its own shortened clock, so the lock set from the full move ends with it. */
export function releaseCommandGrabLock(f: Fighter, move: Readonly<AuthoredSpecial>): void {
  if (move.commandGrab === undefined || f.special.grabFrame <= 0) return;
  f.special.lockFrames = 0;
  f.attack.cooldown = 0;
}

/** Whether a caught command grab is still in its hold, before the effect lands. */
export function commandGrabHolding(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial> | undefined): boolean {
  const grab = move?.commandGrab;
  return grab !== undefined && f.special.grabFrame > 0 && f.special.frame <= f.special.grabFrame + grab.holdFrames;
}
