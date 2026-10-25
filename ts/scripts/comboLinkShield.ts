import { f32 } from "wisp/src/sim/f32";
import type { ComboSetup } from "../src/game/match/comboRoute";
import { frameSteered } from "../src/game/match/padScene";
import { ShieldBreak } from "../src/game/sim/codes";
import { canAttack, canShieldGrab } from "../src/game/sim/conditions";
import { copyControls, neutralControls } from "../src/game/sim/roster";
import { VICTIM_OPTIONS } from "./agencyBranch";
import { type Defender, type Opener, Sim, defenderMask, toward } from "./comboExplorer";

const NEUTRAL = neutralControls();
const SHIELD = VICTIM_OPTIONS.find((option) => option.id === "shield");

export interface Shielded {
  readonly shieldAdvantage: number;
  readonly shieldDamage: number;
  readonly shieldBreak: boolean;
}

export function onShield(setup: ComboSetup, opener: Opener, limit: number): Shielded | undefined {
  if (opener.throw !== undefined || SHIELD === undefined) return undefined;
  const sim = new Sim(setup);
  const d: Defender = { name: "none", di: "none" };
  const dash = opener.dash ?? 0;
  let contacts = 0;
  let damage = 0;
  let drain = 0;
  let attackerFree: number | undefined;
  let victimFree: number | undefined;
  for (let n = 1; n <= limit * 2; n++) {
    const a = sim.a;
    const b = sim.b;
    const am = n <= dash ? toward(a, b) : n === dash + 1 ? opener.move.press(a, b) : 0;
    const shields = b.visuals.shield;
    const energy = b.shield.energy;
    frameSteered(sim.scene, (slot) => (slot === 0 ? am : slot === 1 ? defenderMask(d, n, undefined, b, a) : 0), (controls, slot) => {
      if (slot !== 1) return;
      copyControls(controls, NEUTRAL);
      SHIELD.press(controls, n, 1);
    });
    if (sim.b.visuals.shield !== shields) {
      contacts++;
      damage = f32(damage + Math.max(0, energy - sim.b.shield.energy - drain));
      attackerFree = undefined;
      victimFree = undefined;
    } else drain = Math.max(0, energy - sim.b.shield.energy);
    if (sim.b.shield.breakState !== ShieldBreak.none) return { shieldAdvantage: 0, shieldDamage: Math.round(damage * 10) / 10, shieldBreak: true };
    if (contacts === 0) {
      if (n > limit) return undefined;
      continue;
    }
    if (attackerFree === undefined && canAttack(sim.a)) attackerFree = n;
    if (victimFree === undefined && canShieldGrab(sim.b)) victimFree = n;
    if (attackerFree !== undefined && victimFree !== undefined) return { shieldAdvantage: victimFree - attackerFree, shieldDamage: Math.round(damage * 10) / 10, shieldBreak: false };
  }
  return undefined;
}
