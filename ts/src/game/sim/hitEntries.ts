import type { Fighter } from "./fighter";

export function alreadyHitRegion(attackerSlot: number, attacker: Fighter, target: Fighter, window: number): boolean {
  for (const entry of target.hits.entries) {
    if (entry.attacker === attackerSlot && entry.attackSerial === attacker.attack.serial && entry.window >= window) return true;
  }
  return false;
}

export function recordHitRegion(attackerSlot: number, attacker: Fighter, target: Fighter, window: number): void {
  attacker.attack.hit = true;
  const { hits } = target;
  hits.lastAttacker = attackerSlot;
  hits.lastAttackSerial = attacker.attack.serial;
  hits.lastWindow = window;
  for (const entry of hits.entries) {
    if (entry.attacker === undefined || entry.attacker === attackerSlot) {
      entry.attacker = attackerSlot;
      entry.attackSerial = attacker.attack.serial;
      entry.window = window;
      return;
    }
  }
}
