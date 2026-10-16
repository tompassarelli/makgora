import { f32 } from "wisp/src/sim/f32";
import { projectedShield, SHIELD_MODEL_RADIUS } from "../presentation/shieldPose";
import { SHIELD_MAX, type Fighter } from "../sim/fighter";

export const SHIELD_ENERGY_SETUP = "-dev setup slots 1 4;training on;partner stand none none 0;hit-areas off;items off;drops off;quick";

export const SHIELD_ENERGY_SAMPLES = ["down", "full", "mid", "low"] as const;
export type ShieldEnergySample = typeof SHIELD_ENERGY_SAMPLES[number];

export interface ShieldEnergyCapture {
  sample: ShieldEnergySample;
  pending: boolean;
  lines: string[];
}

export function shieldEnergyReady(sample: ShieldEnergySample, fighter: Readonly<Fighter>, frame: number): boolean {
  if (sample === "down") return !fighter.shield.raised;
  const limit = sample === "full" ? SHIELD_MAX : sample === "mid" ? SHIELD_MAX / 2 : SHIELD_MAX / 12;
  return fighter.shield.raised && fighter.shield.energy <= limit || frame > 600;
}

export function shieldEnergyReceipt(sample: ShieldEnergySample, fighter: Readonly<Fighter>, frame: number): string {
  const pose = projectedShield(fighter, true);
  const raised = fighter.shield.raised;
  const energy = fighter.shield.energy;
  const valid = sample === "down" ? !raised && !pose.visible
    : raised && pose.visible && pose.scale > 0 && (sample === "full" ? energy >= SHIELD_MAX - 1
      : sample === "mid" ? energy > SHIELD_MAX / 3 && energy <= SHIELD_MAX / 2 : energy > 0 && energy <= SHIELD_MAX / 12);
  return `SMASHCRAFT SHIELD sample=${sample} frame=${frame} raised=${raised ? "T" : "F"} energy=${energy} drawn=${pose.visible ? "T" : "F"} centreX=${pose.x} centreZ=${pose.z} radius=${f32(pose.scale * SHIELD_MODEL_RADIUS)} pass=${valid ? 1 : 0}`;
}
