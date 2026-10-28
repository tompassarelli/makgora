import type { AuthoredSpecial } from "./schema";

export function landsBeforeSwing(move: Readonly<AuthoredSpecial> | undefined, frame: number): boolean {
  if (move?.swingsThroughLanding !== true) return false;
  for (const region of move.regions ?? []) if (region.firstFrame <= frame) return false;
  return true;
}
