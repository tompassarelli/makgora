import type { AuthoredSpecial } from "../sim/specials/schema";

type Write = (field: string, value: number) => void;

export function writeStrikeTraits(move: Readonly<AuthoredSpecial>, int: Write, real: Write): void {
  if (move.radial === true) int("radial", 1);
  const status = move.strikeStatus;
  if (status === undefined) return;
  int("strikeStatus.kind", status.kind);
  int("strikeStatus.frames", status.frames);
  int("strikeStatus.every", status.tick?.every ?? 0);
  real("strikeStatus.damage", status.tick?.damage ?? 0.0);
  if (status.perPercent !== undefined) {
    real("strikeStatus.perPercent", status.perPercent.frames);
    int("strikeStatus.cap", status.perPercent.cap);
  }
  if (status.groundedOnly === true) int("strikeStatus.groundedOnly", 1);
}
