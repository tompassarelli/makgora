




// Replay checksums serialize an absent fighter slot or surface as -1.
import { type TechInput, emptyTechInput } from "./geometry/techInput";
import { at } from "wisp/src/runtime/lookup";
import {
  type AttackStyle,
  Character,
  DownState,
  DuoOrder,
  DuoRole,
  SpecialCarry,
  GrabAction,
  GroundAction,
  GrappleState,
  LedgeState,
  ParasolState,
  ParryBuffer,
  ProjectileKind,
  SPECIAL_ACTION_CAPACITY,
  ShieldBreak,
  SpecialAction,
  SurfaceContact,
} from "./codes";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type FighterTuning, authoredTuning } from "./tuning";
import { HitElement } from "./hitRegions";
import { initializeInfluenceOperands } from "./influenceOperands";
import { type Bear, type FreezeTrap, REST_PLACED, RESTING_GROUPS, type Resting, type StageCannon, type Water } from "./fighterRest";
import type { SpecialPlacement, SpecialProjectile } from "./specials/schema";

export const PROJECTILE_CAPACITY = 16;
export const SHIELD_MAX = 60.0;

export const SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES = 2;
export const FAST_FALL_INPUT_WINDOW = 4;
/** a platform drop needs down pressed fewer input frames ago than this. */
export const PLATFORM_DROP_INPUT_WINDOW = 6;
/** Frames after platform contact whose stick still chooses stand or drop (smashcraft:docs/gameplay-design.md, "Platforms"). */
export const WALL_TECH_JUMP_INPUT_WINDOW_FRAMES = 20;
/** a wall jump needs the stick to have crossed the horizontal smash deadzone fewer input frames ago than this. */
export const WALL_JUMP_FLICK_FRAMES = 3;
/** A neutral special faces the side the stick last pressed at most this many input frames before it (smashcraft:docs/gameplay-design.md, "Turnaround specials"). */
export const TURNAROUND_SPECIAL_WINDOW_FRAMES = 8;
export const RESPAWN_FRAMES = 60;
export const RESPAWN_HEIGHT = 280.0;
export const RESPAWN_INVINCIBLE_FRAMES = 90;
const STARTING_STOCKS = 3;







export interface MeleeMotionValue {
  original: number;
  published: number;
}

interface Motion {
  x: number;
  z: number;

  deltaX: number;
  deltaZ: number;
  vx: number;
  vz: number;
  meleeX: MeleeMotionValue;
  meleeZ: MeleeMotionValue;
  meleeVelocityZ: MeleeMotionValue;
  grounded: boolean;

  surface: number | undefined;
  crouching: boolean;
  fastFalling: boolean;
  fastFallDownHeld: boolean;

  fastFallInputAge: number;

  previousStickSide: number;

  stickSideAge: number;

  turnaroundSide: number;

  turnaroundAge: number;
}

interface GroundMovement {
  dashFrame: number;
  dashDirection: number;
  action: GroundAction;
  actionFrame: number;
  runBrakeFramesRemaining: number;
  turnRunEntryFacing: number;
  turnRunFacingCommandLatched: boolean;
  turnRunPausePending: boolean;
  pivotEligible: boolean;
  pivotGraceFrames: number;
  pivotDashFrame: number;
  pivotDashActionFrame: number;

  dashGrabWindow: number;
}

interface Jump {

  inputAge: number;
  remaining: number;
  serial: number;
  isDouble: boolean;
  squat: number;

  ascent: number;
  held: boolean;

  dodgeQueued: boolean;
  dodgeX: number;
  dodgeZ: number;
}

interface Launch {
  knockbackX: number;
  knockbackZ: number;
  meleeKnockbackX: MeleeMotionValue;
  meleeKnockbackZ: MeleeMotionValue;
  groundKnockbackX: number;

  knockbackAge: number | undefined;
  damageLevel: number;
  hitstun: number;

  throwHitstun: boolean;
  hitlag: number;
  hitlagFrames: number;
  hitlagEndAge: number;
  sdiFollowup: boolean;
  diPending: boolean;
  diLaunchSpeed: number;
  diSerial: number;
  diAngleDegrees: number;
  sdiWasGrounded: boolean;
  sdiLaunchesUpward: boolean;
  sdiSerial: number;
  asdiSerial: number;

  sdiHitTravel: number;
  sdiStringTravel: number;
  sdiStepX: number;
  sdiStepZ: number;
  sdiStepTravel: number;
  sdiNextX: number;
  sdiNextZ: number;
  sdiNextTravel: number;
}

interface Shield {
  raised: boolean;
  tiltX: number;
  tiltZ: number;

  strength: number;
  energy: number;
  stun: number;
  heldFrames: number;
  releaseLag: number;

  pushbackX: number;
  recoilX: number;
  recoilZ: number;
  meleeRecoilX: MeleeMotionValue;
  meleeRecoilZ: MeleeMotionValue;
  drainResumePending: boolean;
  triggerWasActive: boolean;
  triggerAge: number;
  reflectFrames: number;
  perfectFrames: number;

  perfectActionFrames: number;

  redParryTried: boolean;
  parryBuffer: ParryBuffer;

  parryBufferDirection: number;
  breakState: ShieldBreak;
  breakFrame: number;
  breakSerial: number;
  breakRemaining: number;
}

interface Attack {
  style: AttackStyle | undefined;
  frame: number;
  duration: number;
  serial: number;
  hit: boolean;
  dashGrab: boolean;
  pivotGrab: boolean;

  cooldown: number;
  smashCharging: boolean;
  smashChargeFrames: number;
  smashChargeAllowed: boolean;
  strongUp: boolean;
}


interface HitEntry {
  attacker: number | undefined;
  attackSerial: number;
  window: number;
}

interface HitRegistry {
  readonly entries: HitEntry[];

  lastAttacker: number | undefined;
  lastAttackSerial: number | undefined;
  lastWindow: number;
}


interface VisualSerials {
  grab: number;
  throw: number;
  hit: number;
  hitElectric: boolean;
  hitElement: HitElement;
  hitStrength: number;
  hitStrong: boolean;

  hitHeight: number;
  hitPummel: boolean;
  shieldElectric: boolean;
  shield: number;
  shieldReflect: number;

  manaDrained: number;

  poisonBursts: number;
  spellPass: number;
  armorAbsorbs: number;
}

interface Special {
  action: SpecialAction;
  variant: number;
  frame: number;
  duration: number;
  lockFrames: number;

  fall: boolean;

  readonly cooldowns: number[];
  direction: number;
  hit: boolean;

  readonly hitTargets: (number | undefined)[];

  form: number;

  aimX: number;
  aimZ: number;

  beamX: number;
  beamZ: number;
  beamLength: number;

  airtimeUses: number;

  grabFrame: number;

  /** The slot plus one of the foe a seeking move locked onto; 0 before it locks. */
  seekTarget: number;

  /** Frames banked by a charging special; kept through other actions until a swing spends it. */
  charge: number;

  refire: boolean;
  refires: number;
  parasol: ParasolState;

  guarded: boolean;
  egg: boolean;
  carry: SpecialCarry;
  empoweredShots: number;
  empoweredFrames: number;
}

export interface Projectile {
  life: number;
  x: number;
  z: number;
  direction: number;
  kind: ProjectileKind;
  visualFamily: Character;
  velocityX: number;
  velocityZ: number;
  serial: number;
  damageMultiplier: number;

  newlyReflected: boolean;

  poolHits: number;

  poolWait: number;

  spec: SpecialProjectile | undefined;

  surface: number | undefined;

  bounces: number;
  homeward: boolean;
  lastStruck: number | undefined;
}


interface Dodge {
  airDodging: boolean;
  airFrame: number;

  airUsed: boolean;

  airMotionFrames: number;
  groundFrame: number;
  groundDirection: number;
  groundEntryFacing: number;
}

interface Landing {
  lag: number;
  buffering: boolean;
  wavedash: boolean;
  dashBuffer: number;
  heldSide: number;
}

interface Down {
  state: DownState;
  frame: number;
  direction: number;
  waitRemaining: number;
  faceUp: boolean;

  attackQueued: boolean;
}


interface Tech extends TechInput {
  window: number;
}


interface SurfaceRecovery {
  state: SurfaceContact;
  frame: number;
  velocityApplied: boolean;
  wallJumpQueued: boolean;

  wallJumpRepeat: number;

  wallJumpAge: number | undefined;

  wallJumpSide: number;

  wallJumpsUsed: number;
  reflectCooldown: number;
  lastReflectedSurface: number | undefined;
  contactSerial: number;
  contactKind: SurfaceContact;
  contactApproachSpeed: number;
  contactX: number;
  contactZ: number;
  contactNormalX: number;
  contactNormalZ: number;
}

interface Grab {

  pummels: number;

  grabbedFrames: number;

  heldFrames: number;

  queuedThrow: GrabAction;
  action: GrabAction;
  frame: number;
  serial: number;
  mashX: number;
  mashZ: number;
  owner: number | undefined;
  target: number | undefined;
  reel: number;
}






/** The stick's last 14 frames as 4-bit zones, newest in the low nibble of `recent` and carrying on into `older`; see stickHistory.ts. */
interface StickHistory {
  recent: number;
  older: number;
}

interface PlatformInput {
  downHeld: boolean;
  downAge: number;
  dropConsumed: boolean;
}

interface Grapple {
  state: GrappleState;
  frame: number;
  surface: number;
  anchorX: number;
  anchorZ: number;
  length: number;
  spent: boolean;
  aim: number;
}

interface Ledge {
  state: LedgeState;
  side: number;
  frame: number;
  serial: number;
  intangible: number;
  regrab: number;
  grabs: number;
}


interface Status {
  offscreenFrames: number;
  damage: number;
  stocks: number;
  respawn: number;
  out: boolean;
  invincible: number;
  frozenFrames: number;

  freezeImmunityFrames: number;

  armorFrames: number;
  armorMaxDamage: number;
  armorKnockback: number;

  armorChills: boolean;

  condition: number;
  conditionFrames: number;
  conditionGroup: number;
  conditionImmunityFrames: number;
  conditionHits: number;

  readonly conditionImmunity: number[];

  poisonFrames: number;
  poisonEvery: number;
  poisonDamage: number;

  soakFrames: number;
  soakLevel: number;

  poisonStacks: number;
  poisonStackFrames: number;

  divineFrames: number;

  cursedBy: number | undefined;
  curseFrames: number;
  healed: number;
  summonFrames: number;


  buff: number;
  buffFrames: number;

  manaShield: boolean;
  petrifyIn: number;
  petrified: boolean;
  petrifyDamage: number;

  aura: boolean;
  auraFrames: number;
  slowFrames: number;
  slowScale: number;
  stacks: number;
  struckBy: number | undefined;
}


interface Meter {
  ultimate: number;
}

export const DUO_RING_INTS = 32;

export interface Duo {
  role: DuoRole;
  link: number;
  readonly ring: number[];
  head: number;
  order: DuoOrder;
  orderFrame: number;
  reviveSpent: boolean;
  swapCooldown: number;
  tossCooldown: number;
}

export interface Victim {
  duoChain: number;
  duoFree: number;
  netImmune: number;
  grabImmuneDuo: number;
  handoffs: number;
  handoffWindow: number;
  shieldRun: number;
  shieldFree: number;
}


export interface PlacedObject {
  life: number;
  age: number;
  x: number;
  z: number;
  direction: number;
  durability: number;
  serial: number;
  spec: SpecialPlacement | undefined;
  readonly struck: (number | undefined)[];
  specialStruck: number;
  mode: number;
  modeFrame: number;
  apart: number;
  bitten: number;
  hits: number;
  surface: number | undefined;
}

export interface Fighter {
  character: Character;
  tuning: FighterTuning;
  facing: number;
  readonly motion: Motion;
  readonly ground: GroundMovement;
  readonly jump: Jump;
  readonly launch: Launch;
  readonly shield: Shield;
  readonly attack: Attack;
  readonly hits: HitRegistry;
  readonly visuals: VisualSerials;
  readonly special: Special;
  readonly projectiles: readonly Readonly<Projectile>[];
  projectileSlots: number;
  readonly bear: Readonly<Bear>;
  readonly freezeTrap: Readonly<FreezeTrap>;
  restingGroups: number;
  readonly dodge: Dodge;
  readonly landing: Landing;
  readonly down: Down;
  readonly tech: Tech;
  readonly surfaceRecovery: SurfaceRecovery;
  readonly grab: Grab;
  readonly ledge: Ledge;
  readonly grapple: Grapple;
  readonly platform: PlatformInput;
  readonly stick: StickHistory;
  readonly cannon: Readonly<StageCannon>;
  readonly water: Readonly<Water>;
  readonly status: Status;
  readonly meter: Meter;
  duo: Duo | undefined;
  victim: Victim | undefined;
  readonly placed: Resting<PlacedObject>;
  readonly pack: readonly Resting<PlacedObject>[];
}

const repeat = <T>(count: number, make: () => T): T[] => Array.from({ length: count }, () => make());

export function createDuo(): Duo {
  return { role: DuoRole.solo, link: -1, ring: repeat(DUO_RING_INTS, () => 0), head: 0, order: DuoOrder.copy, orderFrame: 0, reviveSpent: false, swapCooldown: 0, tossCooldown: 0 };
}

export function createVictim(): Victim {
  return { duoChain: 0, duoFree: 0, netImmune: 0, grabImmuneDuo: 0, handoffs: 0, handoffWindow: 0, shieldRun: 0, shieldFree: 0 };
}

/** A solo fighter holds no duo record and an unstruck one no victim record; readers take these resting values for them. */
export const RESTING_DUO: Readonly<Duo> = createDuo();
export const RESTING_VICTIM: Readonly<Victim> = createVictim();

export function duoRole(fighter: Readonly<Fighter>): DuoRole {
  return fighter.duo?.role ?? DuoRole.solo;
}

/** Whether the fighter is a partner body in flight from its leader's toss. */
export function isTossed(fighter: Readonly<Fighter>): boolean {
  return fighter.duo?.role === DuoRole.partner && fighter.duo.order === DuoOrder.tossed;
}

export function mutableDuo(fighter: Fighter): Duo {
  if (fighter.duo === undefined) fighter.duo = createDuo();
  return fighter.duo;
}

export function mutableVictim(fighter: Fighter): Victim {
  if (fighter.victim === undefined) fighter.victim = createVictim();
  return fighter.victim;
}

// One empty entry per participant (PARTICIPANT_CAPACITY), written out so Lua
// sizes the array part: a copy's first writes into it allocate nothing (#400).
const noSlots = (): (number | undefined)[] => [undefined, undefined, undefined, undefined];

function emptyProjectile(): Projectile {
  return {
    life: 0,
    x: 0.0,
    z: 0.0,
    direction: 0,
    kind: ProjectileKind.blaster,
    visualFamily: Character.rifleman,
    velocityX: 0.0,
    velocityZ: 0.0,
    serial: 0,
    damageMultiplier: 1.0,
    newlyReflected: false,
    poolHits: 0,
    poolWait: 0,
    spec: undefined,
    surface: undefined,
    bounces: 0,
    homeward: false,
    lastStruck: undefined,
  };
}


export function createFighter(character: Character, startX: number, facing: number, spareCount = packLength(character) > 2 ? PACK_CAPACITY : 2): Fighter {
  const tuning = authoredTuning(character);
  const spares = repeat(spareCount, createPlacedObject);
  const fighter: Fighter = {
    character,
    tuning,
    facing,
    motion: {
      x: startX,
      z: 0.0,
      deltaX: 0.0,
      deltaZ: 0.0,
      vx: 0.0,
      vz: 0.0,
      meleeX: { original: 0.0, published: 0.0 },
      meleeZ: { original: 0.0, published: 0.0 },
      meleeVelocityZ: { original: 0.0, published: 0.0 },
      grounded: true,
      surface: undefined,
      crouching: false,
      fastFalling: false,
      fastFallDownHeld: false,
      fastFallInputAge: PLATFORM_DROP_INPUT_WINDOW,
      previousStickSide: 0,
      stickSideAge: WALL_JUMP_FLICK_FRAMES,
      turnaroundSide: 0,
      turnaroundAge: TURNAROUND_SPECIAL_WINDOW_FRAMES + 1,
    },
    ground: {
      dashFrame: 0,
      dashDirection: 0,
      action: GroundAction.none,
      actionFrame: 0,
      runBrakeFramesRemaining: 0,
      turnRunEntryFacing: 0,
      turnRunFacingCommandLatched: false,
      turnRunPausePending: false,
      pivotEligible: false,
      pivotGraceFrames: 0,
      pivotDashFrame: 0,
      pivotDashActionFrame: 0,
      dashGrabWindow: 0,
    },
    jump: {
      inputAge: WALL_TECH_JUMP_INPUT_WINDOW_FRAMES,
      remaining: 2,
      serial: 0,
      isDouble: false,
      squat: 0,
      ascent: 0,
      held: false,
      dodgeQueued: false,
      dodgeX: 0,
      dodgeZ: 0,
    },
    launch: {
      knockbackX: 0.0,
      knockbackZ: 0.0,
      meleeKnockbackX: { original: 0.0, published: 0.0 },
      meleeKnockbackZ: { original: 0.0, published: 0.0 },
      groundKnockbackX: 0.0,
      knockbackAge: undefined,
      damageLevel: 0,
      hitstun: 0,
      throwHitstun: false,
      hitlag: 0,
      hitlagFrames: 0,
      hitlagEndAge: 16,
      sdiFollowup: false,
      diPending: false,
      diLaunchSpeed: 0.0,
      diSerial: 0,
      diAngleDegrees: 0.0,
      sdiWasGrounded: false,
      sdiLaunchesUpward: false,
      sdiSerial: 0,
      asdiSerial: 0,
      sdiHitTravel: 0,
      sdiStringTravel: 0,
      sdiStepX: 0,
      sdiStepZ: 0,
      sdiStepTravel: 0,
      sdiNextX: 0,
      sdiNextZ: 0,
      sdiNextTravel: 0,
    },
    shield: {
      raised: false,
      tiltX: 0.0,
      tiltZ: 0.0,
      strength: 1.0,
      energy: SHIELD_MAX,
      stun: 0,
      heldFrames: 0,
      releaseLag: 0,
      pushbackX: 0.0,
      recoilX: 0.0,
      recoilZ: 0.0,
      meleeRecoilX: { original: 0.0, published: 0.0 },
      meleeRecoilZ: { original: 0.0, published: 0.0 },
      drainResumePending: false,
      triggerWasActive: false,
      triggerAge: SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES,
      reflectFrames: 0,
      perfectFrames: 0,
      perfectActionFrames: 0,
      redParryTried: false,
      parryBuffer: ParryBuffer.none,
      parryBufferDirection: 0,
      breakState: ShieldBreak.none,
      breakFrame: 0,
      breakSerial: 0,
      breakRemaining: 0.0,
    },
    attack: {
      style: undefined,
      frame: 0,
      duration: 0,
      serial: 0,
      hit: false,
      dashGrab: false,
      pivotGrab: false,
      cooldown: 0,
      smashCharging: false,
      smashChargeFrames: 0,
      smashChargeAllowed: false,
      strongUp: false,
    },
    hits: {
      entries: repeat(PARTICIPANT_CAPACITY, () => ({ attacker: undefined, attackSerial: 0, window: 0 })),
      lastAttacker: undefined,
      lastAttackSerial: undefined,
      lastWindow: 0,
    },
    visuals: { grab: 0, throw: 0, hit: 0, hitElectric: false, hitElement: HitElement.normal, hitStrength: 0, hitStrong: false, hitHeight: 1, hitPummel: false, shieldElectric: false, shield: 0, shieldReflect: 0, manaDrained: 0, poisonBursts: 0, spellPass: 0, armorAbsorbs: 0 },
    special: {
      action: SpecialAction.none,
      variant: 0,
      frame: 0,
      duration: 0,
      lockFrames: 0,
      fall: false,
      cooldowns: repeat(SPECIAL_ACTION_CAPACITY, () => 0),
      direction: 0,
      hit: false,
      hitTargets: noSlots(),
      form: 0,
      aimX: 0.0,
      aimZ: 0.0,
      beamX: 0.0,
      beamZ: 0.0,
      beamLength: 0.0,
      airtimeUses: 0,
      grabFrame: 0,
      seekTarget: 0,
      charge: 0,
      refire: false,
      refires: 0,
      parasol: ParasolState.none,
      guarded: false,
      egg: false,
      carry: SpecialCarry.none,
      empoweredShots: 0,
      empoweredFrames: 0,
    },
    projectiles: repeat(PROJECTILE_CAPACITY, () => emptyProjectile()),
    projectileSlots: 0,
    bear: { life: 0, x: 0.0, z: 0.0, velocityX: 0.0, velocityZ: 0.0, swipeCooldown: 0, hitSerial: 0, surface: undefined },
    freezeTrap: { life: 0, arming: 0, x: 0.0, z: 0.0, surface: undefined, serial: 0, cooldown: 0 },
    restingGroups: RESTING_GROUPS,
    dodge: { airDodging: false, airFrame: 0, airUsed: false, airMotionFrames: 0, groundFrame: 0, groundDirection: 0, groundEntryFacing: 0 },
    landing: { lag: 0, buffering: false, wavedash: false, dashBuffer: 0, heldSide: 0 },
    down: { state: DownState.none, frame: 0, direction: 0, waitRemaining: 0, faceUp: true, attackQueued: false },
    tech: { ...emptyTechInput(), window: 0 },
    surfaceRecovery: {
      state: SurfaceContact.none,
      frame: 0,
      velocityApplied: false,
      wallJumpQueued: false,
      wallJumpRepeat: 0,
      wallJumpAge: undefined,
      wallJumpSide: 0,
      wallJumpsUsed: 0,
      reflectCooldown: 0,
      lastReflectedSurface: undefined,
      contactSerial: 0,
      contactKind: SurfaceContact.none,
      contactApproachSpeed: 0.0,
      contactX: 0.0,
      contactZ: 0.0,
      contactNormalX: 0.0,
      contactNormalZ: 0.0,
    },
    grab: { pummels: 0, grabbedFrames: 0, heldFrames: 0, queuedThrow: GrabAction.none, action: GrabAction.none, frame: 0, serial: 0, mashX: 0, mashZ: 0, owner: undefined, target: undefined, reel: 0 },
    ledge: { state: LedgeState.none, side: 0, frame: 0, serial: 0, intangible: 0, regrab: 0, grabs: 0 },
    grapple: { state: GrappleState.none, frame: 0, surface: 0, anchorX: 0.0, anchorZ: 0.0, length: 0.0, spent: false, aim: 0 },
    platform: { downHeld: false, downAge: 3, dropConsumed: false },
    stick: { recent: 0, older: 0 },
    cannon: { held: undefined, firing: undefined, cooldown: 0, passing: false },
    water: { inWater: false, frames: 0, entries: 0, hydraFrame: 0, hydraX: 0.0, hydraStrikeFrame: -1 },
    status: { offscreenFrames: 0, damage: 0.0, stocks: STARTING_STOCKS, respawn: 0, out: false, invincible: 0, frozenFrames: 0, freezeImmunityFrames: 0, armorFrames: 0, armorMaxDamage: 0.0, armorKnockback: 0.0, armorChills: false, condition: 0, conditionFrames: 0, conditionGroup: 0, conditionImmunityFrames: 0, conditionHits: 0, conditionImmunity: [0, 0, 0], divineFrames: 0, cursedBy: undefined, curseFrames: 0, healed: 0.0, summonFrames: 0, poisonFrames: 0, poisonEvery: 0, poisonDamage: 0.0, soakFrames: 0, soakLevel: 0, poisonStacks: 0, poisonStackFrames: 0, buff: 0, buffFrames: 0, manaShield: false, petrifyIn: 0, petrified: false, petrifyDamage: 0.0, aura: false, auraFrames: 0, slowFrames: 0, slowScale: 0.0, stacks: 0, struckBy: undefined },
    meter: { ultimate: 0 },
    duo: undefined,
    victim: undefined,
    placed: createPlacedObject(),
    pack: packFrom(spares, packLength(character)),
  };
  PACK_SPARES.set(fighter, spares);
  initializeInfluenceOperands(fighter);
  return fighter;
}

/** Animals a pack holds at most: a Beastmaster's quilbeast and hawk, a Shadow Hunter's two Big Bad Voodoo wards, Chen's Storm and Fire spirits, a Firelord's two Lava Spawns, or a Peon's five Tower Rush towers. */
export const PACK_CAPACITY = 5;

function packLength(character: Character): number {
  if (character === Character.peon) return PACK_CAPACITY;
  return character === Character.beastmaster || character === Character.shadowHunter || character === Character.chen || character === Character.firelord ? 2 : 0;
}

// Every fighter keeps PACK_CAPACITY placed objects for its pack, kept out of
// its fields so saved records and the copy stay as they are: a copy grows the
// pack from them and never creates a table, into a cold snapshot or a rematch
// that brings a Beastmaster back (#400).
const PACK_SPARES = new WeakMap<Readonly<Fighter>, readonly PlacedObject[]>();

// The pack's table starts with every spare, so Lua sizes its array part once and growing it never allocates.
function packFrom(spares: readonly PlacedObject[], length: number): PlacedObject[] {
  const pack = spares.slice();
  pack.length = length;
  return pack;
}

/** The objects a fighter's pack grows into; a fighter not made by createFighter has none. */
export function packSpares(fighter: Readonly<Fighter>): readonly PlacedObject[] | undefined {
  return PACK_SPARES.get(fighter);
}


export function createPlacedObject(): PlacedObject {
  return { life: 0, age: 0, x: 0.0, z: 0.0, direction: 1, durability: 0.0, serial: 0, spec: undefined, struck: noSlots(), specialStruck: 0, mode: 0, modeFrame: 0, apart: 0, bitten: 0, hits: 0, surface: undefined };
}

export function placedObject(fighter: Readonly<Fighter>, slot = 0): Resting<PlacedObject> {
  return slot === 0 ? fighter.placed : at(fighter.pack, slot - 1);
}

export function mutablePlacedObject(fighter: Fighter, slot = 0): PlacedObject {
  fighter.restingGroups = fighter.restingGroups & ~REST_PLACED;
  return placedObject(fighter, slot) as PlacedObject;
}
