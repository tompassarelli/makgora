import { restCompanionBody } from "../companionBody";
import { bindTether } from "./foeTether";
import { releaseCommandGrabLock } from "./commandGrabLock";
import { startAim, steerAim } from "./aimZone";
import { requestedSlot } from "./slotRequest";
import { max, min } from "../../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { advanceHeroConditions } from "../heroStatus";
import { SpecialAction, SpecialCarry } from "../codes";
import { openParasol } from "../parasol";
import { type Fighter, mutablePlacedObject, placedObject } from "../fighter";
import { type FighterSpecials, type AuthoredSpecial, type FrameWindow, CompanionMode, CompanionOrder, type SpecialKit, type SpecialPlacement, type SpecialProjectile, type SpecialEgg, SpecialForm, SpecialSlot, specialForm, specialKit } from "./schema";
import { airCastVariant } from "./airFloat";
import { advanceChannel, advanceRefire, skipSpecialTo } from "./refire";
import { type Controls, type Roster } from "../roster";
import { endDivineShield, refreshAirOnExit } from "../transitions";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { floorSurfaceBelow, mainDeckLeft, mainDeckRight, mainDeckZAt, surfaceZAt } from "../stage";
import { tetherToLedge } from "./ledgeTether";
import { ownedCount } from "./ownedProjectiles";
import { partnerCallBlocked } from "../duoPartner";
import { castVariant, spendEmpowered } from "./empowered";
import { isHeroSpecialAction, runningHeroSpecial, inWindow, applyWindows, projectileAnchor } from "./runningMove";
import { castFits } from "./placements";
import { recallProjectiles, spawnHeroProjectileAt, endLiveCasts, holdOrb } from "./heroProjectiles";
import { swingFullCharge, holdCharge, throwFullDroppingCharge } from "./heroForms";
import { holdSteeredShot, faceHeldStick } from "./heroMotion";
import { applyFrameEffectsBeforeLedge, applyFrameEffectsBeforePlacements, applyFrameEffectsAfterPlacements } from "./frameEffects";

function recallHolds(f: Readonly<Fighter>, kit: Readonly<SpecialKit>): boolean {
  if (kit.recallWhile === "armor") return f.status.armorFrames > 0;
  if (kit.recallWhile === "projectile") {
    const spec = kit.ground.projectiles?.[0];
    return spec !== undefined && ownedCount(f, spec) > 0;
  }
  return (kit.recallGroundOnly !== true || f.motion.grounded) && placedObject(f, kit.ground.placement?.slot).life > 0;
}

export interface SpecialRefusal {
  groundOnly: boolean;
}

export interface HeroSpecialChoice {
  slot: SpecialSlot;
  form: SpecialForm;
  variant: number;
}

const choice: HeroSpecialChoice = { slot: SpecialSlot.neutral, form: SpecialForm.ground, variant: 0 };

export function chooseHeroSpecial(f: Readonly<Fighter>, specials: Readonly<FighterSpecials>, input: Readonly<Controls>, out: SpecialRefusal, world?: Roster): HeroSpecialChoice | undefined {
  out.groundOnly = false;
  const slot = requestedSlot(f, specials, input);
  if ((f.special.cooldowns[SpecialAction.heroNeutral + slot] ?? 0) > 0) return undefined;
  const kit = specialKit(specials, slot);
  const airborne = !f.motion.grounded;
  const recalls = kit.recall !== undefined && recallHolds(f, kit);
  const form: SpecialForm = recalls ? SpecialForm.recall : airborne && kit.air !== undefined ? SpecialForm.air : SpecialForm.ground;
  const move = specialForm(kit, form);
  if (move.groundOnly === true && airborne) {
    out.groundOnly = true;
    return undefined;
  }
  if (partnerCallBlocked(world, f, move)) return undefined;
  if (move.armor?.shell === true && f.status.armorFrames > 0) return undefined;
  if (move.oncePerAirtime === true && airborne && (f.special.airtimeUses & (1 << slot)) !== 0) return undefined;
  if (move.command?.order === CompanionOrder.lunge && !companionReady(f, move.command.slot)) return undefined;
  const variant = castVariant(world, f, move);
  if (!castFits(f, specialForm(kit, form, variant))) return undefined;
  choice.slot = slot;
  choice.form = form;
  choice.variant = variant;
  return choice;
}

export function resetSpecialOnStock(f: Fighter): void {
  f.special.airtimeUses = 0;
}

export function steerHeroSpecial(f: Fighter, input: Readonly<Controls>): void {
  const move = runningHeroSpecial(f);
  if (move?.aimFrames === undefined || f.special.frame >= move.aimFrames) return;
  steerAim(f.special, move, input);
}

export function enterHeroSpecial(f: Fighter, chosen: Readonly<HeroSpecialChoice>, input: Readonly<Controls>): AuthoredSpecial {
  const specials = f.tuning.specials;
  if (specials === undefined) throw new Error("hero special without a kit");
  const move = specialForm(specialKit(specials, chosen.slot), chosen.form, chosen.variant);
  const { special } = f;
  endDivineShield(f);
  spendEmpowered(f, specialForm(specialKit(specials, chosen.slot), chosen.form), chosen.variant);
  special.form = chosen.form;
  special.variant = chosen.variant;
  special.grabFrame = 0;
  startAim(f, move, input);
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  special.guarded = false;
  special.seekTarget = 0;
  special.carry = SpecialCarry.none;
  special.cooldowns[SpecialAction.heroNeutral + chosen.slot] = move.cooldownFrames ?? 0;
  if (move.replacesLive === true) endLiveCasts(f, specialKit(specials, chosen.slot));
  if (move.oncePerAirtime === true) special.airtimeUses |= 1 << chosen.slot;
  if (move.recallsProjectiles === true) recallProjectiles(f);
  if (move.charge?.drops === true) special.charge = 0;
  applyWindows(f, move, 0);
  swingFullCharge(f, move);
  return move;
}

export function companionReady(f: Readonly<Fighter>, slot = 0): boolean {
  const placed = placedObject(f, slot);
  return placed.life > 0 && placed.spec?.companion !== undefined && (placed.mode === CompanionMode.follow || placed.mode === CompanionMode.returning);
}

function orderCompanion(f: Fighter, order: CompanionOrder, slot = 0): void {
  if (placedObject(f, slot).life <= 0 || placedObject(f, slot).spec?.companion === undefined) return;
  const placed = mutablePlacedObject(f, slot);
  if (order === CompanionOrder.lunge) {
    if (!companionReady(f, slot)) return;
    placed.mode = CompanionMode.lunge;
    placed.direction = f.facing < 0 ? -1 : 1;
    placed.bitten = 0;
    placed.modeFrame = 0;
  } else if (placed.mode !== CompanionMode.stunned) {
    placed.mode = CompanionMode.returning;
    placed.modeFrame = 0;
  }
}

function placeObjects(f: Fighter, spec: Readonly<SpecialPlacement>, frame: number, stage: number, matchFrame: number): void {
  const spread = spec.spread;
  if (spread === undefined) {
    if (spec.frame !== frame) return;
    if (spec.atMark !== undefined) {
      placeOnMark(f, spec, spec.atMark, stage, matchFrame);
      return;
    }
    placeOne(f, spec, spec.slot ?? 0, 1, spec.offsetX, undefined);
    if (spec.outwardPair === true) placeOne(f, spec, (spec.slot ?? 0) + 1, -1, spec.offsetX, undefined);
    return;
  }
  for (let index = 0; index < spread.offsets.length; index++) {
    if (spec.frame + index * spread.every === frame) placeOne(f, spec, (spec.slot ?? 0) + index, 1, at(spread.offsets, index), stage);
  }
}

function placeOnMark(f: Fighter, spec: Readonly<SpecialPlacement>, mark: Readonly<SpecialProjectile>, stage: number, matchFrame: number): void {
  const drawn = projectileAnchor(f, mark);
  if (drawn === undefined) return;
  const surface = floorSurfaceBelow(stage, matchFrame, drawn.x, f32(drawn.z + spec.height));
  if (surface === undefined) return;
  const slot = spec.slot ?? 0;
  placeOne(f, spec, slot, 1, 0.0, undefined);
  const placed = mutablePlacedObject(f, slot);
  placed.x = drawn.x;
  placed.z = surfaceZAt(stage, surface, matchFrame, drawn.x);
  placed.surface = surface;
  placed.mode = CompanionMode.stunned;
}

export function placeOne(f: Fighter, spec: Readonly<SpecialPlacement>, slot: number, side: number, offsetX: number, deckStage: number | undefined): void {
  if (spec.keepExisting === true && placedObject(f, slot).life > 0) return;
  const placed = mutablePlacedObject(f, slot);
  const facing = f.facing < 0 ? -1 : 1;
  placed.life = spec.life;
  placed.age = 0;
  placed.x = f32(f.motion.x + f32(f32(f.facing * side) * offsetX));
  placed.z = f32(f.motion.z + (spec.offsetZ ?? 0.0));
  if (deckStage !== undefined) {
    placed.x = min(f32(mainDeckRight(deckStage) - spec.radius), max(f32(mainDeckLeft(deckStage) + spec.radius), placed.x));
    placed.z = mainDeckZAt(deckStage, placed.x);
  }
  placed.direction = spec.outwardPair === true ? facing * side : facing;
  if (spec.mark !== undefined) spawnHeroProjectileAt(f, spec.mark, placed.x, f32(placed.z + spec.mark.offsetZ), placed.direction, false, f.attack.serial + 1);
  placed.durability = spec.durability;
  placed.serial++;
  placed.spec = spec;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) placed.struck[slot] = undefined;
  placed.specialStruck = 0;
  placed.mode = CompanionMode.follow;
  placed.modeFrame = 0;
  placed.apart = 0;
  placed.bitten = 0;
  placed.hits = 0;
  restCompanionBody(placed, spec.companion?.body);
  placed.surface = f.motion.surface;
}

export function hatchesOnHit(f: Readonly<Fighter>): boolean {
  if (!isHeroSpecialAction(f.special.action)) return false;
  const egg = runningHeroSpecial(f)?.egg;
  return egg !== undefined && inWindow(egg.window, f.special.frame);
}

export function becomeEgg(f: Fighter): void {
  f.special.egg = true;
  f.special.fall = true;
  f.jump.remaining = 0;
  f.motion.fastFalling = false;
}

export function heroEgg(f: Readonly<Fighter>): SpecialEgg | undefined {
  const specials = f.tuning.specials;
  if (!f.special.egg || specials === undefined) return undefined;
  for (let slot = 0; slot <= SpecialSlot.down; slot++) {
    const kit = specialKit(specials, slot);
    const egg = kit.ground.egg ?? kit.air?.egg;
    if (egg !== undefined) return egg;
  }
  return undefined;
}

function endHeroSpecial(f: Fighter, move: Readonly<AuthoredSpecial>): void {
  if ((move.helpless === true || (move.helplessOnMiss === true && !f.special.hit)) && !f.motion.grounded) {
    f.special.fall = true;
    f.jump.remaining = 0;
  }
  refreshAirOnExit(f);
  openParasol(f, move.parasol === true);
  f.special.action = SpecialAction.none;
  f.special.frame = 0;
  f.special.carry = SpecialCarry.none;
  releaseCommandGrabLock(f, move);
}

function shortenOnPress(f: Fighter, window: Readonly<FrameWindow> | undefined, input: Readonly<Controls> | undefined): void {
  if (window !== undefined && input?.specialPressed === true && inWindow(window, f.special.frame)) skipSpecialTo(f, window.last + 1);
}

export function advanceHeroSpecial(f: Fighter, stage = 0, input?: Readonly<Controls>, world?: Roster, matchFrame = 0): void {
  const move = runningHeroSpecial(f);
  if (move === undefined) return;
  if (holdOrb(f, move, input) || holdCharge(f, move.charge, bindTether(world, f, move.charge))) return;
  if (holdSteeredShot(f, move, input)) return;
  advanceRefire(f, move.refire, input);
  advanceChannel(f, move.channel, input);
  shortenOnPress(f, move.shorten, input);
  if (throwFullDroppingCharge(f, move)) return;
  if (move.turnsAround === true) faceHeldStick(f, input);
  const frame = f.special.frame;
  applyFrameEffectsBeforeLedge(f, move, frame);
  if (tetherToLedge(world, f, move.ledgeTether, frame, stage)) return;
  applyFrameEffectsBeforePlacements(f, move, frame, stage, matchFrame, input, world);
  if (move.placement !== undefined) placeObjects(f, move.placement, frame, stage, matchFrame);
  for (const summon of move.summons ?? []) placeObjects(f, summon, frame, stage, matchFrame);
  if (move.command?.frame === frame) orderCompanion(f, move.command.order, move.command.slot);
  applyFrameEffectsAfterPlacements(f, move, frame);
  applyWindows(f, move, frame);
  if (frame >= heroSpecialEndFrame(f, move)) {
    if (move.recall === true) mutablePlacedObject(f).life = 0;
    endHeroSpecial(f, move);
  }
}

export function heroSpecialEndFrame(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): number {
  const grab = move.commandGrab;
  return grab !== undefined && f.special.grabFrame > 0 ? f.special.grabFrame + grab.holdFrames + grab.recovery : move.endFrame;
}

export function advanceHeroStatus(f: Fighter): void {
  if (f.status.armorFrames > 0) f.status.armorFrames--;
  if (f.status.divineFrames > 0) f.status.divineFrames--;
  advanceHeroConditions(f);
}

export function specialCooldownReady(f: Readonly<Fighter>, action: number): boolean {
  return (f.special.cooldowns[action] ?? 0) <= 0;
}

/** Starts the fighter's ultimate after the special action began (docs/design/ultimates.md). */
export function enterUltimate(f: Fighter, input: Readonly<Controls>): AuthoredSpecial | undefined {
  const move = f.tuning.ultimate;
  if (move === undefined) return undefined;
  const { special } = f;
  endDivineShield(f);
  special.form = 0;
  special.variant = airCastVariant(f, move);
  special.grabFrame = 0;
  const aimX = input.specialX !== 0 ? input.specialX : input.direction;
  const aimZ = input.specialZ !== 0 ? input.specialZ : input.verticalDirection;
  special.aimX = aimX < 0 ? -1 : aimX > 0 ? 1 : 0;
  special.aimZ = aimZ < 0 ? -1 : aimZ > 0 ? 1 : 0;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  special.guarded = false;
  special.seekTarget = 0;
  applyWindows(f, move, 0);
  return move;
}

export function heroSpecialCancelOpen(f: Readonly<Fighter>): boolean {
  const move = runningHeroSpecial(f);
  return move?.jumpCancelFrame !== undefined && f.launch.hitlag <= 0 && f.special.frame >= move.jumpCancelFrame;
}

export function endCancelledSpecial(f: Fighter): void {
  f.special.action = SpecialAction.none;
  f.special.frame = 0;
  f.special.lockFrames = 0;
  f.attack.cooldown = 0;
}

export function jumpCancelHeroSpecial(f: Fighter, input: Readonly<Controls>): void {
  if (input.jumpPressed && heroSpecialCancelOpen(f)) endCancelledSpecial(f);
}
