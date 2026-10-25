import { meleeHandling } from "../../src/game/sim/meleeHandling";
import { LEDGER_ROWS } from "./ledger";
import { FOX_NEUTRAL_AIR, maievNeutralAir } from "./moves";

const SWITCHES: Readonly<Record<string, () => void>> = {
  "air-dodge": () => { meleeHandling.airDodgeEndsHelpless = true; },
  "strong-hit-hitlag": () => { meleeHandling.strongHitsAddNoHitlag = true; },
  "throw-regrab": () => { meleeHandling.throwsAllowRegrab = true; },
  "throw-knockback": () => { meleeHandling.throwsAtNeutralWeight = true; },
  "maiev-neutral-air-angle": () => { for (const effect of maievNeutralAir()) effect.sakurai = true; },
  "maiev-neutral-air-damage": () => { for (const effect of maievNeutralAir()) effect.damage = FOX_NEUTRAL_AIR.damage; },
  "maiev-neutral-air-knockback": () => {
    for (const effect of maievNeutralAir()) {
      effect.base = FOX_NEUTRAL_AIR.base;
      effect.growth = FOX_NEUTRAL_AIR.growth;
    }
  },
};

export const switchableRows = (): string[] => Object.keys(SWITCHES);

export function meleeSwitchRefusal(id: string): string | undefined {
  const row = LEDGER_ROWS.find((own) => own.id === id);
  if (row === undefined) return `--melee takes a ledger row id; there is no row ${id}`;
  if ("undocumented" in row.melee) return `${id} has no Melee value (${row.melee.undocumented}), so it cannot run on Melee's handling`;
  if ("spread" in row.melee) return `${id} has a Melee spread, not one value, so it cannot run on Melee's handling`;
  if (row.status.kind === "parity") return `${id} is already parity with Melee`;
  if (SWITCHES[id] === undefined) return `${id} has no switch to Melee's handling yet; rows with one: ${switchableRows().join(", ")}`;
  return undefined;
}

export function switchToMelee(id: string): void {
  const refusal = meleeSwitchRefusal(id);
  if (refusal !== undefined) throw new Error(refusal);
  SWITCHES[id]?.();
}
