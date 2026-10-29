import { max } from "../../core/numbers";
import { Character, SpecialAction } from "../codes";
import { type Fighter, type Projectile } from "../fighter";
import { type AuthoredSpecial, type SpecialArmor, type SpecialProjectile, specialForm, specialKit, ultimateForm } from "./schema";
import { currentTraits } from "../identityTraits";
import { stackedArmor } from "../stackPassive";

export const isHeroSpecialAction = (action: number): boolean => action >= SpecialAction.heroNeutral && action <= SpecialAction.heroUltimate;

export function runningHeroSpecial(f: Readonly<Fighter>): AuthoredSpecial | undefined {
  if (f.special.action === SpecialAction.heroUltimate) {
    const ultimate = f.tuning.ultimate;
    return ultimate === undefined ? undefined : ultimateForm(ultimate, f.special.form);
  }
  const specials = f.tuning.specials;
  if (specials === undefined || !isHeroSpecialAction(f.special.action)) return undefined;
  return specialForm(specialKit(specials, f.special.action - SpecialAction.heroNeutral), f.special.form, f.special.variant);
}

export const inWindow = (window: { readonly first: number; readonly last: number } | undefined, frame: number): boolean =>
  window !== undefined && frame >= window.first && frame <= window.last;

export function applyWindows(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number): void {
  const { status } = f;
  if (f.character === Character.sylvanas && f.special.action === SpecialAction.heroUltimate) {
    if (inWindow(move.intangible, frame)) status.invincible = max(status.invincible, 1);
  } else if (inWindow(move.intangible, frame + 1)) status.invincible = max(status.invincible, 2);
  else if (inWindow(move.intangible, frame)) status.invincible = max(status.invincible, 1);
  if (move.armor !== undefined) applyArmorWindow(f, move.armor, frame);
}

function applyArmorWindow(f: Fighter, armor: SpecialArmor, frame: number): void {
  const { status } = f;
  if (armor.shell === true) {
    if (frame + 1 !== armor.first) return;
    status.armorFrames = armor.last - armor.first + 2;
    status.armorChills = armor.chillsStriker === true && currentTraits(f).status === true;
  } else if (inWindow(armor, frame)) {
    status.armorFrames = max(status.armorFrames, 2);
    status.armorChills = false;
  } else return;
  status.armorMaxDamage = stackedArmor(f, armor.maxDamage, armor.perStack);
  status.armorKnockback = armor.knockback ?? 0.0;
}

export function projectileAnchor(owner: Readonly<Fighter>, spec: Readonly<SpecialProjectile> | undefined): Readonly<Projectile> | undefined {
  if (spec === undefined) return undefined;
  for (const projectile of owner.projectiles) if (projectile.life > 0 && projectile.spec === spec) return projectile;
  return undefined;
}
