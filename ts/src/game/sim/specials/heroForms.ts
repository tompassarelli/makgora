import { chargeBanked, chargeHolds } from "./charge";
import { changesAimZone, chargedAimX, chargedAimZ } from "./aimZone";
import { max, min } from "../../core/numbers";
import { at } from "wisp/src/runtime/lookup";
import { Character, SpecialAction } from "../codes";
import { type Fighter } from "../fighter";
import { type AuthoredSpecial, type FighterSpecials, type SpecialCharge, type SpecialFollowUp, FOLLOW_UP_FORM, FollowUpInput, SpecialForm, SpecialSlot, chargeStage, specialForm, specialKit } from "./schema";
import { type Controls } from "../roster";
import { refreshAirOnExit } from "../transitions";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { runningHeroSpecial, inWindow, applyWindows } from "./runningMove";

export function swingFullCharge(f: Fighter, move: Readonly<AuthoredSpecial>): void {
  const charge = move.charge;
  const followUps = move.followUps;
  if (charge === undefined || followUps === undefined || f.special.charge < charge.full) return;
  const stage = chargeStage(charge, f.special.charge);
  for (let index = 0; index < followUps.length; index++) {
    const followUp = at(followUps, index);
    if (followUp.chargeStage !== stage) continue;
    f.special.form += FOLLOW_UP_FORM * (index + 1);
    enterFollowUp(f, followUp.special);
    return;
  }
}

export function holdCharge(f: Fighter, charge: Readonly<SpecialCharge> | undefined): boolean {
  const { special } = f;
  if (charge === undefined || special.form >= FOLLOW_UP_FORM || special.frame !== charge.hold + 1 || !chargeHolds(charge, special.charge)) return false;
  special.charge = chargeBanked(charge, special.charge);
  special.frame = charge.hold;
  special.lockFrames++;
  f.attack.cooldown++;
  return true;
}

export function throwFullDroppingCharge(f: Fighter, move: Readonly<AuthoredSpecial>): boolean {
  const charge = move.charge;
  if (charge?.drops !== true || f.special.form >= FOLLOW_UP_FORM || f.special.frame !== charge.hold + 1 || f.special.charge < charge.full) return false;
  swingFullCharge(f, move);
  return f.special.form >= FOLLOW_UP_FORM;
}

function chargeStageOpen(f: Readonly<Fighter>, charge: Readonly<SpecialCharge> | undefined, followUp: Readonly<SpecialFollowUp>): boolean {
  return followUp.chargeStage === undefined || (charge !== undefined && chargeStage(charge, f.special.charge) === followUp.chargeStage);
}

export function prepareBansheeContacts(f: Fighter): void {
  if (f.character !== Character.sylvanas || f.special.action !== SpecialAction.heroUltimate || f.launch.hitlag > 0) return;
  followUpOnContact(f);
  const move = runningHeroSpecial(f);
  if (move !== undefined && inWindow(move.intangible, f.special.frame + 1)) f.status.invincible = max(f.status.invincible, 1);
}

function landFromSpecialFall(f: Fighter): void {
  const specials = f.tuning.specials;
  if (specials === undefined) return;
  for (let slot = SpecialSlot.neutral; slot <= SpecialSlot.down; slot++) {
    if ((f.special.airtimeUses & (1 << slot)) === 0) continue;
    const lag = specialForm(specialKit(specials, slot), SpecialForm.air, f.special.variant).fallLandingLag;
    if (lag !== undefined) f.landing.lag = max(f.landing.lag, lag);
  }
}

export function carriesChargeAcrossLanding(f: Readonly<Fighter>): boolean {
  return runningHeroSpecial(f)?.carriesChargeOnLanding === true && f.special.form === SpecialForm.air;
}

function enterGroundForm(f: Fighter, ground: Readonly<AuthoredSpecial>): void {
  f.special.form = SpecialForm.ground;
  f.special.duration = ground.endFrame;
  applyWindows(f, ground, f.special.frame);
}

function firstEffectFrame(form: Readonly<AuthoredSpecial>): number {
  let first = form.endFrame;
  for (const region of form.regions ?? []) first = min(first, region.firstFrame);
  for (const projectile of form.projectiles ?? []) first = min(first, projectile.spawnFrame);
  first = min(first, form.placement?.frame ?? first);
  first = min(first, form.command?.frame ?? first);
  first = min(first, form.guard?.first ?? first);
  first = min(first, form.commandGrab?.first ?? first);
  first = min(first, form.armor === undefined ? first : form.armor.first - 1);
  first = min(first, form.burst?.frame ?? first);
  first = min(first, form.buff?.frame ?? first);
  first = min(first, form.ritual?.frame ?? first);
  return first;
}

function landCairneNeutral(f: Fighter, move: Readonly<AuthoredSpecial>, specials: Readonly<FighterSpecials>): boolean {
  if (!(f.character === Character.cairne && f.special.action === SpecialAction.heroNeutral
    && f.special.form === SpecialForm.air && f.special.frame < (move.projectiles?.[0]?.spawnFrame ?? 0))) return false;
  const ground = specialForm(specials.neutral, SpecialForm.ground, f.special.variant);
  f.special.form = SpecialForm.ground;
  f.special.duration = ground.endFrame;
  f.landing.lag = max(f.landing.lag, f.special.lockFrames);
  applyWindows(f, ground, f.special.frame);
  return true;
}

function landDownGround(f: Fighter, move: Readonly<AuthoredSpecial>, specials: Readonly<FighterSpecials>): boolean {
  if (f.special.action !== SpecialAction.heroDown || (f.special.form !== SpecialForm.ground && f.special.form !== SpecialForm.air)) return false;
  const ground = specialForm(specials.down, SpecialForm.ground, f.special.variant);
  if (f.special.frame >= firstEffectFrame(move)) return false;
  f.special.form = SpecialForm.ground;
  if (f.special.frame >= firstEffectFrame(ground)) f.special.frame = 0;
  f.special.duration = ground.endFrame;
  f.special.lockFrames = max(0, ground.endFrame - f.special.frame);
  f.attack.cooldown = f.special.lockFrames;
  applyWindows(f, ground, f.special.frame);
  return true;
}

export function landHeroSpecial(f: Fighter): boolean {
  const move = runningHeroSpecial(f);
  if (move === undefined) landFromSpecialFall(f);
  if (move?.landingLag === undefined) return false;
  const specials = f.tuning.specials;
  if (carriesChargeAcrossLanding(f) && specials !== undefined) {
    enterGroundForm(f, specialForm(specialKit(specials, f.special.action - SpecialAction.heroNeutral), SpecialForm.ground, f.special.variant));
    return true;
  }
  if (specials !== undefined && (landCairneNeutral(f, move, specials) || landDownGround(f, move, specials))) return true;
  refreshAirOnExit(f);
  f.special.action = SpecialAction.none;
  f.special.frame = 0;
  f.special.lockFrames = 0;
  f.attack.cooldown = 0;
  f.landing.lag = max(f.landing.lag, move.landingLag);
  return true;
}

/** Starts the running move's contact follow-up once it has struck; call before the frame advances. */
export function followUpOnContact(f: Fighter): void {
  const { special } = f;
  if (!special.hit || special.form >= FOLLOW_UP_FORM) return;
  const followUps = runningHeroSpecial(f)?.followUps ?? [];
  for (let index = 0; index < followUps.length; index++) {
    const followUp = at(followUps, index);
    if (followUp.input !== FollowUpInput.contact || !inWindow(followUp.window, special.frame + 1)) continue;
    special.form += FOLLOW_UP_FORM * (index + 1);
    enterFollowUp(f, followUp.special);
    return;
  }
}

function followUpPressed(f: Readonly<Fighter>, followUp: Readonly<SpecialFollowUp>, input: Readonly<Controls>): boolean {
  const kind = followUp.input ?? FollowUpInput.special;
  const x = chargedAimX(input);
  const z = chargedAimZ(input);
  const pressed = kind === FollowUpInput.attack ? input.attackPressed : kind === FollowUpInput.shield ? input.shieldPressed : kind === FollowUpInput.special ? input.specialPressed : kind === FollowUpInput.release ? !input.specialHeld : kind === FollowUpInput.auto && changesAimZone(f, x, z);
  const stick = followUp.stick;
  return pressed && (stick === undefined || (Math.abs(x) === stick.x && z === stick.z));
}

export function pressedFollowUp(f: Readonly<Fighter>, input: Readonly<Controls>): number {
  const move = runningHeroSpecial(f);
  const followUps = move?.followUps;
  if (followUps === undefined || f.special.form >= FOLLOW_UP_FORM || f.launch.hitlag > 0 || f.launch.hitstun > 0) return -1;
  for (let index = 0; index < followUps.length; index++) {
    const followUp = at(followUps, index);
    if (inWindow(followUp.window, f.special.frame + 1) && chargeStageOpen(f, move?.charge, followUp) && followUpPressed(f, followUp, input)) return index;
  }
  return -1;
}

export function followUpHeroSpecial(f: Fighter, input: Readonly<Controls>): boolean {
  const { special } = f;
  const followUps = runningHeroSpecial(f)?.followUps;
  const index = pressedFollowUp(f, input);
  if (followUps === undefined || index < 0) return false;
  const followUp = at(followUps, index);
  const next = followUp.special;
  if (followUp.facesStick === true && input.direction !== 0) f.facing = input.direction < 0 ? -1 : 1;
  if (followUp.stick !== undefined && followUp.stick.x !== 0) f.facing = chargedAimX(input) < 0 ? -1 : 1;
  special.form += FOLLOW_UP_FORM * (index + 1);
  enterFollowUp(f, next);
  return true;
}

export function enterFollowUp(f: Fighter, next: Readonly<AuthoredSpecial>): void {
  const { special } = f;
  special.frame = 0;
  special.duration = next.endFrame;
  special.lockFrames = next.endFrame;
  if (next.spendsCharge === true) special.charge = 0;

  f.attack.cooldown = next.endFrame;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  applyWindows(f, next, 0);
}
