import { HitElement } from "../../sim/codes";
import { groundHit } from "../../sim/heroes/groundNormals";
import { type AuthoredSpecial, type SpecialCharge, type SpecialFollowUp, type SpecialKit, type SpecialProjectile, FollowUpInput, frames } from "../../sim/specials/schema";

export const SHURIKEN_MODEL = "Abilities\\Spells\\NightElf\\FanOfKnives\\FanOfKnivesMissile.mdx";
export const SHURIKEN_MOST = 6;
export const SHURIKEN_CHARGE: SpecialCharge = { hold: 8, full: 75, stages: SHURIKEN_MOST - 1, releases: true };
const SHURIKEN_AIR_CHARGE: SpecialCharge = { ...SHURIKEN_CHARGE, throwsStored: true };
export const SHURIKEN_DAMAGE = 2.0;
export const SHURIKEN_SPREAD = 0.5;
export const SHURIKEN_FIRST = 6;
export const SHURIKEN_GAP = 3;
export const SHURIKEN_GROUND_RECOVERY = 23;
export const SHURIKEN_AIR_RECOVERY = 17;
export const SHURIKEN_AIR_LANDING_LAG = 12;
export const SHURIKEN_GROUND_SPEED = 12.0;
export const SHURIKEN_AIR_SPEED = 10.0;
export const SHURIKEN_AIR_DROP = -7.0;
const SHURIKEN_LIFE = 20;
const SHURIKEN_JUMP_CANCEL = 2;
const CHARGE_WINDOW = frames(1, SHURIKEN_CHARGE.hold + 1);

export const shurikenCount = (stage: number): number => Math.max(1, stage + 1);

const shuriken = (index: number, count: number, air: boolean): SpecialProjectile => ({
  model: SHURIKEN_MODEL, spawnFrame: SHURIKEN_FIRST + SHURIKEN_GAP * index, offsetX: 34.0, offsetZ: 62.0,
  velocityX: air ? SHURIKEN_AIR_SPEED : SHURIKEN_GROUND_SPEED,
  velocityZ: (air ? SHURIKEN_AIR_DROP : 0.0) + SHURIKEN_SPREAD * (index - (count - 1) / 2),
  life: SHURIKEN_LIFE, radius: 9.0, modelRadius: 12.0, effect: groundHit(SHURIKEN_DAMAGE, 0, 12.0, 4.0, HitElement.normal), reflectable: true, limit: 1,
});

const volley = (stage: number, air: boolean): AuthoredSpecial => {
  const count = shurikenCount(stage);
  const last = SHURIKEN_FIRST + SHURIKEN_GAP * (count - 1);
  return {
    name: "Shuriken Volley", endFrame: last + (air ? SHURIKEN_AIR_RECOVERY : SHURIKEN_GROUND_RECOVERY), landingLag: air ? SHURIKEN_AIR_LANDING_LAG : undefined, spendsCharge: true,
    projectiles: Array.from({ length: count }, (_, index) => shuriken(index, count, air)),
  };
};

const followUps = (air: boolean): readonly SpecialFollowUp[] => [
  ...Array.from({ length: SHURIKEN_CHARGE.stages + 1 }, (_, stage): SpecialFollowUp => ({ window: CHARGE_WINDOW, input: FollowUpInput.release, chargeStage: stage, special: volley(stage, air) })),
  { window: CHARGE_WINDOW, input: FollowUpInput.shield, special: { name: "Shuriken Store", endFrame: 4 } },
];

export const SHURIKEN_NEUTRAL: SpecialKit = {
  name: "Shuriken Volley",
  description: "Hold to ready shurikens, up to six, and release to throw what is ready. Shield or jump while charging keeps them for later; in the air the next press throws all he keeps at once.",
  ground: { endFrame: SHURIKEN_CHARGE.hold + 2, charge: SHURIKEN_CHARGE, jumpCancelFrame: SHURIKEN_JUMP_CANCEL, followUps: followUps(false) },
  air: { endFrame: 2, charge: SHURIKEN_AIR_CHARGE, followUps: followUps(true) },
};
