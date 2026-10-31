import { idiv, imod } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import type { MoveRegion, StrikeCapsule } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import type { AppliedStatus } from "../appliedStatus";
import type { HurtPose } from "../hurtboxes";
import type { StickMotion } from "../stickMotion";
import type { ProjectileBounce, ProjectileVelocity, SpecialGaze } from "./volleys";
import type { CastWindows, FrameWindow, SpecialChannel } from "./castWindows";
import type { SpecialBeam } from "./specialBeam";
import type { SpecialSteer, SpecialSteeredShot } from "./shotSteering";
import type { ToggleAura } from "./auraSchema";
export type { SpecialSelfHit, SpecialSteer, SpecialSteeredShot } from "./shotSteering";
export type { FrameWindow } from "./castWindows";

export const SpecialSlot = { neutral: 0, side: 1, up: 2, down: 3 } as const;
export type SpecialSlot = (typeof SpecialSlot)[keyof typeof SpecialSlot];

export const SpecialForm = { ground: 0, air: 1, recall: 3 } as const;
export type SpecialForm = (typeof SpecialForm)[keyof typeof SpecialForm];

export const FOLLOW_UP_FORM = 6;

export const FollowUpInput = { special: 0, attack: 1, shield: 2, contact: 3, auto: 4, guard: 5, release: 6, held: 7 } as const;
export type FollowUpInput = (typeof FollowUpInput)[keyof typeof FollowUpInput];

export const Relocation = { placed: 1, behindLocked: 4 } as const;
export type Relocation = (typeof Relocation)[keyof typeof Relocation];

export interface SpecialMotion extends FrameWindow {
  readonly velocityX: number;
  readonly velocityZ: number;
  readonly aimedSpeed?: number | undefined;
  /** Flies its aimed speed along the stick at any angle, not one of eight directions; its move then keeps the stick as aim, unrounded. */
  readonly freeAim?: true | undefined;

  readonly model?: string | undefined;
  readonly aimedTilt?: { readonly x: number; readonly z: number } | undefined;

  readonly driftSpeed?: number | undefined;
  readonly liftSpeed?: number | undefined;

  readonly stopsAtBody?: boolean | undefined;

  readonly stopsAtShield?: boolean | undefined;

  readonly relocate?: Relocation | undefined;

  readonly relocateProjectile?: SpecialProjectile | undefined;

  readonly relocateReach?: number | undefined;

  /** On its first frame stands its user on the floor under the newest live projectile of `at`; with none that has a floor under it, `fallbackReach` ahead if a floor lies level there, else he stays where he is. */
  readonly resurface?: { readonly at: SpecialProjectile; readonly fallbackReach: number } | undefined;

  readonly throughEdge?: boolean | undefined;

  /** On its first frame, after the move has connected, turns to face the first fighter it struck. */
  readonly facesStruck?: true | undefined;

  /** Flies at `speed` toward the foe locked on its first frame, turning at most the angle whose cosine and sine it names a frame, through platforms. */
  readonly seek?: { readonly speed: number; readonly turnCos: number; readonly turnSin: number } | undefined;

  readonly steer?: SpecialSteer | undefined;
  readonly ride?: { readonly reach: number; readonly offset: number; readonly catchUp: number; readonly aloneVelocityZ: number } | undefined;
}

/** The move's first projectile flies on while the special button is held: it gains `acceleration` a frame up to `maxSpeed`, the stick's vertical sets its climb up to `climbSpeed`, and on release or at the end of its life it becomes `erupts` where it is. */
export interface SpecialHeldOrb {
  readonly frame: number;
  readonly acceleration: number;
  readonly maxSpeed: number;
  readonly climbSpeed: number;
  readonly erupts: SpecialProjectile;
}

export interface SpecialEgg {
  readonly window: FrameWindow;
  readonly fallSpeed: number;
  readonly hatchFrames: number;
}

export interface SpecialCurse { readonly every: number; readonly damage: number; readonly summonDelay: number; readonly portal: SpecialProjectile; readonly summon: SpecialPlacement }
export interface CommandGrab extends FrameWindow {
  readonly strike: StrikeCapsule;
  readonly holdFrames: number;
  readonly effect: Readonly<HitEffect>;
  readonly recovery: number;
  readonly heal?: { readonly heal: number } | undefined;

  readonly status?: AppliedStatus | undefined;
  /** Through the hold, every `every` frames it deals `damage` and heals its user as much; there is no final throw. */
  readonly drain?: { readonly every: number; readonly damage: number } | undefined;
  /** A raised shield stops it, as an ordinary strike is stopped. */
  readonly shieldable?: true | undefined;
}

/** Locks the nearest foe within `range` on frame 1, marks it with `glyph`, and on `frame` strikes it wherever it is with `bolt`: no shield blocks it and nothing reflects it; only intangibility or leaving `range` escapes it. */
export interface TargetedStrike {
  readonly range: number;
  readonly frame: number;
  readonly effect: Readonly<HitEffect>;
  readonly glyph: SpecialProjectile;
  readonly bolt: SpecialProjectile;
  readonly curse?: SpecialCurse | undefined;
}

export interface MotionAim {
  readonly motion: StickMotion;
  readonly aimX: number;
  readonly aimZ: number;
}

export interface AimByMotion {
  readonly motions: readonly MotionAim[];
  readonly otherwise: { readonly aimX: number; readonly aimZ: number };
}

export interface SpecialProjectile {
  readonly spawnFrame: number;
  readonly offsetX: number;
  readonly offsetZ: number;
  readonly velocityX: number;
  readonly velocityZ: number;
  readonly upVelocityX?: number | undefined;
  readonly upVelocityZ?: number | undefined;
  readonly downVelocity?: { readonly velocityX: number; readonly velocityZ: number } | undefined;

  readonly gravity?: number | undefined;
  readonly life: number;
  readonly radius: number;
  readonly activeFrom?: number | undefined;
  readonly effect: Readonly<HitEffect>;
  readonly reflectable: boolean;

  readonly limit: number;

  readonly status?: AppliedStatus | undefined;

  readonly cancelOnInterrupt?: boolean | undefined;

  readonly returnEffect?: Readonly<HitEffect> | undefined;

  readonly catchHeal?: { readonly heal: number } | undefined;

  readonly needsLineOfSight?: boolean | undefined;

  readonly modelRadius?: number | undefined;

  readonly modelOffsetZ?: number | undefined;

  readonly model?: string | undefined;

  readonly modelAnimation?: { readonly sequence: string; readonly warningSeconds: number; readonly activeSeconds: number; readonly rate?: number | undefined } | undefined;

  readonly returns?: { readonly age: number; readonly speed: number } | undefined;

  readonly pool?: ProjectilePool | undefined;

  /** Spawns under the nearest opponent instead of at the owner's offset. */
  readonly atFoe?: boolean | undefined;

  readonly atStageCentre?: boolean | undefined;

  readonly dropsToFloor?: boolean | undefined;

  /** Pulls a spot over the void back along the caster's facing to this far inside the farthest ledge under him, when he stands on or over a floor. */
  readonly ledgeInset?: number | undefined;

  /** Spawns at one of these distances ahead of the caster, not at `offsetX`, by the move's aim: `far` when it points forward and not down, `mid` when down and forward, `near` otherwise. */
  readonly aimedReach?: { readonly near: number; readonly mid: number; readonly far: number } | undefined;

  /** Spawns as `as` instead where no floor lies within `within` of its spot's height. */
  readonly unfloored?: { readonly within: number; readonly as: SpecialProjectile } | undefined;

  /** Launches each target sideways away from the spot's centre, left of it to the left and right of it to the right; a target exactly on it goes away from the owner. The effect's launchX gives the angle and its sign is ignored. */
  readonly launchesFromCentre?: true | undefined;

  /** Spawns at the move's live mark of this spec, offset from it, and not at all once that mark is gone. */
  readonly atMark?: SpecialProjectile | undefined;

  /** What this becomes where it ends when its life runs out or it strikes. */
  readonly expiresInto?: SpecialProjectile | undefined;

  /** Each frame its vertical speed turns by at most `turn` toward the nearest opponent ahead, up to `maxRise`. */
  readonly homing?: { readonly turn: number; readonly maxRise: number } | undefined;
  /** On body or shield contact it becomes this projectile where it is, which deals the hit and then only shows. */
  readonly burstInto?: SpecialProjectile | undefined;
  readonly burn?: { readonly every: number } | undefined;
  readonly steered?: true | undefined;
  /** Where the stage stops it, it becomes its `burstInto` at its last free spot. */
  readonly burstsOnStage?: true | undefined;
  readonly fan?: readonly ProjectileVelocity[] | undefined;
  readonly bounce?: ProjectileBounce | undefined;
  /** A body it reaches, unshielded and unreflected, is caught and reeled in over `reelFrames` into its owner's grab hold. */
  readonly latch?: { readonly reelFrames: number } | undefined;
  /** The first of these thrown in an airtime, reaching a free main-deck ledge it flies toward, reels its airborne, unhelpless owner there into ledge hang. */
  readonly latchesLedge?: true | undefined;
  readonly pierces?: true | undefined;
}

interface ArmorWindow extends FrameWindow { readonly shell?: boolean | undefined; readonly chillsStriker?: boolean | undefined; readonly perStack?: number | undefined }
export type SpecialArmor = ArmorWindow & ({ readonly maxDamage: number; readonly knockback?: undefined } | { readonly knockback: number; readonly maxDamage?: undefined });

interface ProjectilePool {
  readonly every: number;
  readonly growth: number;
  readonly maxRadius: number;
}

export interface SpecialPlacement {

  readonly slot?: number | undefined;
  readonly offsetZ?: number | undefined;

  readonly keepExisting?: boolean | undefined;
  readonly model?: { readonly path: string; readonly height: number; readonly alpha: number; readonly finished?: true; readonly casts?: true } | undefined;

  readonly frame: number;
  readonly offsetX: number;
  readonly radius: number;
  readonly height: number;
  readonly durability: number;
  readonly life: number;
  readonly fireAges: readonly number[];
  readonly shot?: SpecialProjectile | undefined;
  /** Fired instead of `shot` at the last fire age. */
  readonly finalShot?: SpecialProjectile | undefined;
  /** A drawn-only effect spawned on the object as it is placed. */
  readonly mark?: SpecialProjectile | undefined;
  /** A twin goes at the mirrored offset in the next slot; each faces, and fires, away from the owner. */
  readonly outwardPair?: boolean | undefined;
  /** It lasts only while the special that placed it runs, nothing breaks it meanwhile, and its fire skips the hero projectile cap. */
  readonly channeled?: boolean | undefined;
  readonly spread?: { readonly offsets: readonly number[]; readonly every: number } | undefined;
  readonly aimed?: boolean | undefined;
  readonly crumble?: number | undefined;
  readonly atMark?: SpecialProjectile | undefined;
  readonly aura?: true | undefined;

  readonly companion?: SpecialCompanion | undefined;
  readonly taunt?: { readonly radius: number; readonly pull: number } | undefined;
  readonly windWalk?: { readonly frames: number; readonly hop: number } | undefined;
}

export interface SpecialCompanion {

  readonly behavior?: "sentry" | "flying" | undefined;
  readonly followHeight?: number | undefined;
  readonly lungeDrop?: number | undefined;
  readonly volleyFrames?: readonly number[] | undefined;
  readonly waveFrame?: number | undefined;
  readonly engage?: number | undefined;

  readonly followSpeed: number;
  readonly followBehind: number;

  readonly returnSpeed: number;

  readonly lungeStartup: number;
  readonly lungeActive: number;
  readonly lungeRecovery: number;
  readonly lungeTravel: number;

  readonly bite: StrikeCapsule;
  readonly biteEffect: HitEffect;
  readonly biteStatus?: AppliedStatus | undefined;

  readonly stunFrames: number;

  readonly leash: number;
  readonly leashFrames: number;
}

export const CompanionOrder = { lunge: 1, return: 2 } as const;
export type CompanionOrder = (typeof CompanionOrder)[keyof typeof CompanionOrder];

export const CompanionMode = { follow: 0, lunge: 1, stunned: 2, returning: 3, vanished: 4 } as const;
export type CompanionMode = (typeof CompanionMode)[keyof typeof CompanionMode];

export interface LedgeTether extends FrameWindow { readonly reach: StrikeCapsule }

export interface SelfHeal { readonly frame: number; readonly heal: number }

export interface SpecialGuard extends FrameWindow {
  readonly heal: number;

  readonly shieldFrames?: number | undefined;

  /** A guarded strike starts the move's first follow-up at once. */
  readonly counter?: boolean | undefined;
  readonly freezeFrames?: number | undefined;
}

/** Holds frame `hold` while the fighter's charge climbs to `full`; the charge outlasts the move until a swing spends it. */
export interface SpecialCharge {
  readonly hold: number;
  readonly full: number;
  readonly stages: number;
  readonly drops?: true | undefined;
  /** Keeps holding at full until a release follow-up swings, and swings a full charge left stored the moment the move starts; a partial one resumes charging, and a release inside the hold window swings it at its stored stage. */
  readonly releases?: true | undefined;
  /** Starting the move swings whatever is stored, a partial charge at its stored stage, at once and without charging. */
  readonly throwsStored?: true | undefined;
}

export interface AuthoredSpecial extends CastWindows {
  readonly strikesWithProp?: true | undefined;
  readonly variants?: readonly AuthoredSpecial[] | undefined;
  readonly pairedVariant?: { readonly variant: number; readonly within: number; readonly heldWithin: number } | undefined;
  readonly name?: string | undefined;
  readonly endFrame: number;

  readonly cooldownFrames?: number | undefined;
  readonly heldOrb?: SpecialHeldOrb | undefined;

  readonly steersShot?: SpecialSteeredShot | undefined;
  readonly replacesLive?: true | undefined;

  readonly regions?: readonly MoveRegion[] | undefined;
  readonly regionOrigin?: SpecialProjectile | undefined;
  readonly beam?: SpecialBeam | undefined;
  readonly motion?: readonly SpecialMotion[] | undefined;
  readonly projectiles?: readonly SpecialProjectile[] | undefined;
  readonly intangible?: FrameWindow | undefined;
  readonly airStall?: FrameWindow | undefined;
  readonly airFloat?: { readonly sink: number; readonly rise: number } | undefined;
  readonly armor?: SpecialArmor | undefined;
  readonly guard?: SpecialGuard | undefined;
  readonly defensiveUse?: boolean | undefined;

  readonly confirmOnly?: boolean | undefined;
  readonly groundOnly?: boolean | undefined;

  readonly needsFloorBelow?: true | undefined;
  readonly airHoldFrames?: number | undefined;

  readonly oncePerAirtime?: boolean | undefined;
  readonly helpless?: boolean | undefined;

  readonly catchesLedge?: true | undefined;
  readonly helplessOnMiss?: boolean | undefined;
  readonly parasol?: true | undefined;
  readonly landingLag?: number | undefined;
  readonly swingsThroughLanding?: true | undefined;
  readonly carriesChargeOnLanding?: true | undefined;
  readonly fallLandingLag?: number | undefined;

  readonly aimFrames?: number | undefined;
  /** Picks the aim on the press from the stick's recent motion, the first listed motion the stick history completed within its window, else `otherwise`; the stick after the press does not steer it. Aims are facing-relative in x. */
  readonly aimByMotion?: AimByMotion | undefined;
  readonly facesStick?: boolean | undefined;
  readonly hurt?: readonly HurtPose[] | undefined;

  readonly placement?: SpecialPlacement | undefined;
  readonly summons?: readonly SpecialPlacement[] | undefined;
  readonly recall?: boolean | undefined;

  readonly command?: { readonly frame: number; readonly order: CompanionOrder; readonly slot?: number | undefined } | undefined;
  readonly recallsProjectiles?: boolean | undefined;
  readonly commandGrab?: CommandGrab | undefined;
  readonly targetedStrike?: TargetedStrike | undefined;
  readonly strikeStatus?: AppliedStatus | undefined;

  readonly cleanseFrame?: number | undefined;
  readonly followUps?: readonly SpecialFollowUp[] | undefined;

  readonly burst?: { readonly frame: number; readonly from: SpecialProjectile; readonly into: SpecialProjectile } | undefined;
  readonly ritual?: { readonly frame: number } | undefined;

  /** Frames on which each target may be struck again. */
  readonly rehits?: readonly number[] | undefined;
  readonly egg?: SpecialEgg | undefined;

  /** Its user gets back her air jump and air-once specials whenever it ends, as a landing would give. */
  readonly refreshesAir?: true | undefined;
  readonly refire?: FrameWindow | undefined;
  readonly channel?: SpecialChannel | undefined;
  readonly shorten?: FrameWindow | undefined;
  readonly jumpCancelFrame?: number | undefined;

  readonly jumpWindow?: FrameWindow | undefined;
  /** Opponents' specials and ultimates pass through its user over these frames: no damage, knockback, hitlag or status, and a projectile flies on. */
  readonly spellImmune?: FrameWindow | undefined;
  readonly turnsAround?: true | undefined;
  readonly radial?: true | undefined;
  /** Started on the ground it keeps the ground speed it had and slides on traction; started in the air it stops horizontally. */
  readonly groundMomentum?: true | undefined;
  /** A timed movement buff granted on a frame (Metamorphosis, Avatar). */
  readonly buff?: { readonly frame: number; readonly kind: number; readonly frames: number } | undefined;
  readonly selfHeal?: SelfHeal | undefined; readonly revive?: { readonly frame: number; readonly offsetX: number } | undefined; readonly order?: { readonly frame: number } | undefined; readonly swapHold?: { readonly frame: number; readonly variant: number } | undefined; readonly swap?: { readonly frame: number; readonly cooldown: number } | undefined;
  readonly charge?: SpecialCharge | undefined;

  readonly spendsCharge?: true | undefined;
  readonly manaShield?: { readonly frame: number } | undefined;
  readonly gaze?: SpecialGaze | undefined;
  /** Its hits pop a red critical-strike number of the damage dealt over the struck fighter. */
  readonly critical?: true | undefined;
  /** Over these frames a ledge inside `reach` catches the hook, and its user is reeled to hang there. */
  readonly ledgeTether?: LedgeTether | undefined;
  /** On `frame` it switches its user's aura on or off. */
  readonly toggleAura?: ToggleAura<SpecialProjectile> | undefined;
}

export interface SpecialFollowUp {
  readonly window: FrameWindow;
  readonly special: AuthoredSpecial;

  readonly input?: FollowUpInput | undefined;

  readonly facesStick?: boolean | undefined;

  readonly stick?: { readonly x: number; readonly z: number } | undefined;

  /** Opens only at this stage of the move's charge. */
  readonly chargeStage?: number | undefined;
}

export interface SpecialKit {

  readonly name: string;

  /** A press with this motion in the stick history picks this kit, whichever direction the press itself reads. */
  readonly selectedByMotion?: StickMotion | undefined;

  readonly description: string;
  readonly ground: AuthoredSpecial;

  readonly air?: AuthoredSpecial | undefined;

  readonly recall?: AuthoredSpecial | undefined;

  readonly recallWhile?: "projectile" | "armor" | undefined;

  readonly recallGroundOnly?: boolean | undefined;

}

export interface FighterSpecials {
  readonly neutral: SpecialKit;
  readonly side: SpecialKit;
  readonly up: SpecialKit;
  readonly down: SpecialKit;
}

export function specialKit(specials: Readonly<FighterSpecials>, slot: number): SpecialKit {
  return slot === SpecialSlot.side ? specials.side : slot === SpecialSlot.up ? specials.up : slot === SpecialSlot.down ? specials.down : specials.neutral;
}

export function specialForm(kit: Readonly<SpecialKit>, form: number, variant = 0): AuthoredSpecial {
  if (form >= FOLLOW_UP_FORM) {
    const base = specialForm(kit, imod(form, FOLLOW_UP_FORM), variant);
    return base.followUps?.[idiv(form, FOLLOW_UP_FORM) - 1]?.special ?? base;
  }
  const move = form === SpecialForm.recall ? kit.recall ?? kit.ground
    : form === SpecialForm.air ? kit.air ?? kit.ground : kit.ground;
  return variant > 0 ? move.variants?.[variant - 1] ?? move : move;
}

export function ultimateForm(ultimate: Readonly<AuthoredSpecial>, form: number): AuthoredSpecial {
  return form >= FOLLOW_UP_FORM ? ultimate.followUps?.[idiv(form, FOLLOW_UP_FORM) - 1]?.special ?? ultimate : ultimate;
}

export function heroSpecialMove(specials: Readonly<FighterSpecials>, chosen: { readonly slot: number; readonly form: number; readonly variant: number }): AuthoredSpecial {
  return specialForm(specialKit(specials, chosen.slot), chosen.form, chosen.variant);
}

export const frames = (first: number, last: number): FrameWindow => ({ first, last });

export function chargeStage(charge: Readonly<SpecialCharge>, banked: number): number {
  return banked >= charge.full ? charge.stages : idiv(banked * charge.stages, charge.full);
}

export const CHARGED_AIM_FRAMES = 8;

export function chargedAngleMotion(distance: number, travelFrames: number, extraAimFrames = 0): readonly SpecialMotion[] {
  const speed = f32(distance / travelFrames);
  const aim = CHARGED_AIM_FRAMES + extraAimFrames;
  const launch = aim + 1;
  const stop = aim + travelFrames + 1;
  return [
    { ...frames(1, aim), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(launch, stop - 1), velocityX: 0.0, velocityZ: speed, aimedSpeed: speed },
    { ...frames(stop, stop), velocityX: 0.0, velocityZ: 0.0 },
  ];
}

export function stopsSidewaysOnStart(move: Readonly<AuthoredSpecial>, grounded: boolean): boolean {
  return move.groundMomentum === true ? !grounded : grounded && !movementSpecial(move);
}

export function movementSpecial(move: Readonly<AuthoredSpecial>): boolean {
  for (const segment of move.motion ?? []) {
    if (segment.velocityX !== 0.0 || segment.velocityZ !== 0.0 || segment.aimedSpeed !== undefined || segment.driftSpeed !== undefined
      || segment.liftSpeed !== undefined || segment.seek !== undefined || segment.steer !== undefined || segment.relocate !== undefined || segment.resurface !== undefined) return true;
  }
  return false;
}
