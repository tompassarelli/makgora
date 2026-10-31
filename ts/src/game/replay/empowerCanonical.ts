import type { AuthoredSpecial, SpecialProjectile } from "../sim/specials/schema";

type IntWriter = (name: string, value: number) => void;

export function writeEmpowered(int: IntWriter, move: Readonly<AuthoredSpecial>): void {
  if (move.empowers !== undefined) {
    int("empowers.frame", move.empowers.frame);
    int("empowers.shots", move.empowers.shots);
    int("empowers.frames", move.empowers.frames);
  }
  if (move.spendsEmpowered === true) int("spendsEmpowered", 1);
}

export function writePierce(int: IntWriter, spec: Readonly<SpecialProjectile>): void {
  if (spec.pierces === true) int("pierces", 1);
  if (spec.splitCredit === true) int("splitCredit", 1);
}
