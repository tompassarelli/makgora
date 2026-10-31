import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { max } from "../core/numbers";
import { Character, DownState, GrabAction, LedgeState, ShieldBreak, SurfaceContact } from "../sim/codes";
import { attackStartup, isFloorTeching, isGroundDodging, isTumbling } from "../sim/conditions";
import { type Fighter, placedObject } from "../sim/fighter";
import { HitElement } from "../sim/hitRegions";
import { hurtCapsule } from "../sim/geometry/contactGeometry";
import { LEDGE_HANG_DEPTH, LEDGE_HANG_OUTSET } from "../sim/ledge";
import { SMASH_MAX_CHARGE_FRAMES } from "../sim/moves";
import { WORLD_UNITS_PER_MELEE_UNIT } from "../sim/tuning";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { AttackStyle } from "../sim/codes";
import { moveTier } from "./moveTiers";
import { hasFuseSound, hasImpactSound, hasPerformSound, specialMove, specialSlot, specialSoundMove } from "./moveSounds";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { ProjectileKind, SpecialAction } from "../sim/codes";
import { heroDefinition } from "../roster/kits";
import { type AuthoredSpecial, type SpecialProjectile, specialKit } from "../sim/specials/schema";
import { type PlatformCatchEvent, capturePlatformCatchBefore, createPlatformCatch, detectPlatformCatch } from "./platformDust";


export const ImpactLanding = { none: 0, tech: 1, missedTech: 2 } as const;
export type ImpactLanding = (typeof ImpactLanding)[keyof typeof ImpactLanding];


export const JumpCue = { none: 0, ground: 1, double: 2, air: 3, wall: 4 } as const;
export type JumpCue = (typeof JumpCue)[keyof typeof JumpCue];

export const DodgeCue = { none: 0, spot: 1, roll: 2 } as const;
export type DodgeCue = (typeof DodgeCue)[keyof typeof DodgeCue];


const SIDE_KO_X = 920.0;
const FUSE_LEAD_FRAMES = 15;






export interface ImpactEvents {
  previousDown: DownState;
  previouslyOut: boolean;
  previousGroundDodge: number;
  previousSurfaceContactSerial: number;
  previousHitVisualSerial: number;
  previousFrozenFrames: number;
  previousShieldVisualSerial: number;
  previousShieldReflectVisualSerial: number;
  previouslyGrounded: boolean;
  previousJumpSerial: number;
  previouslyAirDodging: boolean;
  previousShieldBreak: ShieldBreak;
  previousDashFrame: number;
  previousX: number;
  previousZ: number;
  previousVelocityX: number;
  previousDownFrame: number;
  previousGrabVisualSerial: number;
  previousThrowVisualSerial: number;
  previouslyCharging: boolean;
  previousChargeFrames: number;
  previousLedgeSerial: number;
  previousLedgeState: LedgeState;
  previousLedgeSide: number;
  previousAttackSerial: number;
  previousAttackFrame: number;
  previousSpecialAction: SpecialAction;
  previousSpecialFrame: number;
  previousSpecialForm: number;
  grab: boolean;
  throwRelease: boolean;
  charge: boolean;
  ready: boolean;
  previousBuiltSerial: number;
  jobDone: boolean;
  previousGrabSerial: number;
  hoisted: boolean;
  ledgeCatch: boolean;
  ledgeRecovery: boolean;

  ledgeX: number;
  ledgeZ: number;
  hit: boolean;
  electric: boolean;
  element: HitElement;
  strength: number;

  tier: number;

  swing: number;

  variant: number;
  perform: number;
  performSerial: number;
  impact: number;
  fuse: number;
  fuseSerial: number;
  fuseX: number;
  fuseZ: number;
  previousFuseSerial: number;
  hitCharacter: Character;
  hitMove: number;
  strong: boolean;
  shieldCharacter: Character;
  shieldMove: number;
  shieldVariant: number;
  pummel: boolean;
  shieldElectric: boolean;
  footstep: "none" | "walk" | "run" | "dash";
  shieldHit: boolean;
  shieldReflect: boolean;
  shieldBreak: boolean;
  ordinaryLanding: boolean;
  readonly platform: PlatformCatchEvent;
  movementDust: boolean;
  runningDust: boolean;
  launchTrail: boolean;
  dodgeTrail: boolean;
  airDodge: boolean;
  respawn: boolean;
  jump: JumpCue;

  jumpOriginX: number;
  jumpOriginZ: number;
  character: Character;
  facing: number;
  koDirectionX: number;
  koDirectionZ: number;
  landing: ImpactLanding;
  dodge: DodgeCue;
  direction: number;
  x: number;
  z: number;
  hitZ: number;
  surface: SurfaceContact;
  surfaceMissedTech: boolean;

  contactX: number;
  contactZ: number;
  normalX: number;
  normalZ: number;
}

export function createImpactEvents(): ImpactEvents {
  return {
    previousDown: DownState.none, previouslyOut: false, previousGroundDodge: 0,
    previousSurfaceContactSerial: 0, previousHitVisualSerial: 0, previousFrozenFrames: 0, previousShieldVisualSerial: 0,
    previousShieldReflectVisualSerial: 0, previouslyGrounded: true, previousJumpSerial: 0,
    previouslyAirDodging: false, previousShieldBreak: ShieldBreak.none, previousDashFrame: 0,
    previousX: 0.0, previousZ: 0.0, previousVelocityX: 0.0, previousDownFrame: 0,
    previousGrabVisualSerial: 0, previousThrowVisualSerial: 0, previouslyCharging: false,
    previousChargeFrames: 0, previousLedgeSerial: 0, previousLedgeState: LedgeState.none,
    previousLedgeSide: 0, previousAttackSerial: 0, previousAttackFrame: 0, previousSpecialAction: SpecialAction.none, previousSpecialFrame: 0, previousSpecialForm: 0, grab: false, throwRelease: false, charge: false, ready: false, previousBuiltSerial: -1, jobDone: false, previousGrabSerial: 0, hoisted: false,
    ledgeCatch: false, ledgeRecovery: false, ledgeX: 0.0, ledgeZ: 0.0, hit: false, electric: false,
    element: HitElement.normal, strength: 0, tier: 0, swing: -1, variant: 0, perform: -1, performSerial: 0, impact: -1, fuse: -1, fuseSerial: 0, fuseX: 0.0, fuseZ: 0.0, previousFuseSerial: 0, hitCharacter: 1, hitMove: -1, strong: false,
    shieldCharacter: 1, shieldMove: -1, shieldVariant: 0, pummel: false, shieldElectric: false, footstep: "none",
    shieldHit: false, shieldReflect: false, shieldBreak: false, ordinaryLanding: false, platform: createPlatformCatch(),
    movementDust: false, runningDust: false, launchTrail: false, dodgeTrail: false, airDodge: false,
    respawn: false, jump: JumpCue.none, jumpOriginX: 0.0, jumpOriginZ: 0.0, character: 1, facing: 1,
    koDirectionX: 0, koDirectionZ: 0, landing: ImpactLanding.none, dodge: DodgeCue.none, direction: 0, x: 0.0, z: 0.0, hitZ: 0.0,
    surface: SurfaceContact.none, surfaceMissedTech: false, contactX: 0.0, contactZ: 0.0,
    normalX: 0.0, normalZ: 0.0,
  };
}


export function captureImpactEventsBefore(events: ImpactEvents, fighter: Readonly<Fighter>): void {
  events.previousDown = fighter.down.state;
  events.previouslyOut = fighter.status.out;
  events.previousGroundDodge = fighter.dodge.groundFrame;
  events.previousSurfaceContactSerial = fighter.surfaceRecovery.contactSerial;
  events.previousHitVisualSerial = fighter.visuals.hit;
  events.previousFrozenFrames = fighter.status.frozenFrames;
  events.previousShieldVisualSerial = fighter.visuals.shield;
  events.previousShieldReflectVisualSerial = fighter.visuals.shieldReflect;
  events.previouslyGrounded = fighter.motion.grounded;
  events.previousJumpSerial = fighter.jump.serial;
  events.previouslyAirDodging = fighter.dodge.airDodging;
  events.previousShieldBreak = fighter.shield.breakState;
  events.previousDashFrame = fighter.ground.dashFrame;
  events.previousX = fighter.motion.x;
  events.previousZ = fighter.motion.z;
  events.previousVelocityX = fighter.motion.vx;
  capturePlatformCatchBefore(events.platform, fighter);
  events.previousDownFrame = fighter.down.frame;
  events.previousGrabVisualSerial = fighter.visuals.grab;
  events.previousThrowVisualSerial = fighter.visuals.throw;
  events.previouslyCharging = fighter.attack.smashCharging;
  events.previousChargeFrames = fighter.attack.smashChargeFrames;
  events.previousLedgeSerial = fighter.ledge.serial;
  events.previousLedgeState = fighter.ledge.state;
  events.previousLedgeSide = fighter.ledge.side;
  events.previousAttackSerial = fighter.attack.serial;
  events.previousAttackFrame = fighter.attack.frame;
  events.previousSpecialAction = fighter.special.action;
  events.previousSpecialFrame = fighter.special.frame;
  events.previousSpecialForm = fighter.special.form;
  events.previousBuiltSerial = lastBuiltSerial(fighter);
  events.previousGrabSerial = fighter.grab.serial;
  events.grab = false;
  events.throwRelease = false;
  events.charge = false;
  events.ready = false;
  events.jobDone = false;
  events.hoisted = false;
  events.ledgeCatch = false;
  events.ledgeRecovery = false;
  events.hit = false;
  events.electric = false;
  events.pummel = false;
  events.footstep = "none";
  events.shieldHit = false;
  events.shieldReflect = false;
  events.shieldBreak = false;
  events.ordinaryLanding = false;
  events.movementDust = false;
  events.runningDust = false;
  events.launchTrail = false;
  events.dodgeTrail = false;
  events.airDodge = false;
  events.respawn = false;
  events.swing = -1;
  events.perform = -1;
  events.impact = -1;
  events.fuse = -1;
  events.hitMove = -1;
  events.shieldMove = -1;
  events.strong = false;
  events.jump = JumpCue.none;
  events.koDirectionX = 0;
  events.koDirectionZ = 0;
  events.landing = ImpactLanding.none;
  events.dodge = DodgeCue.none;
  events.direction = 0;
  events.surface = SurfaceContact.none;
  events.surfaceMissedTech = false;
}


function lastBuiltSerial(fighter: Readonly<Fighter>): number {
  const spec = fighter.tuning.ultimate?.placement;
  const spread = spec?.spread;
  if (spec === undefined || spread === undefined) return -1;
  const slot = (spec.slot ?? 0) + spread.offsets.length - 1;
  if (slot > fighter.pack.length) return -1;
  const placed = placedObject(fighter, slot);
  return placed.spec === spec && placed.life > 0 && placed.age >= (spec.fireAges[0] ?? 0) ? placed.serial : -1;
}

function hitTier(fighter: Readonly<Fighter>, world: Readonly<Roster> | undefined): number | undefined {
  const { lastAttacker, lastAttackSerial } = fighter.hits;
  if (world === undefined || lastAttacker === undefined || !isActive(world, lastAttacker)) return undefined;
  const attacker = fighterAt(world, lastAttacker);
  const { style, serial } = attacker.attack;
  return style === undefined || serial !== lastAttackSerial ? undefined : moveTier(attacker.character, style);
}


const PROJECTILE_REACH = 160.0;
const PROJECTILE_BODY_Z = 50.0;

function firesProjectile(special: Readonly<AuthoredSpecial> | undefined, spec: Readonly<SpecialProjectile>): boolean {
  if (special === undefined) return false;
  if (special.projectiles?.includes(spec) === true) return true;
  for (const followUp of special.followUps ?? []) if (followUp.special.projectiles?.includes(spec) === true) return true;
  return false;
}

function projectileSlot(character: Character, spec: Readonly<SpecialProjectile> | undefined): number {
  const specials = heroDefinition(character)?.specials;
  if (spec === undefined || specials === undefined) return 0;
  for (let slot = 0; slot < 4; slot++) {
    const kit = specialKit(specials, slot);
    if (firesProjectile(kit.ground, spec) || firesProjectile(kit.air, spec) || firesProjectile(kit.recall, spec)) return slot;
  }
  return 0;
}

function firstRegionFrame(fighter: Readonly<Fighter>): number {
  let first = -1;
  for (const region of runningHeroSpecial(fighter)?.regions ?? []) if (first < 0 || region.firstFrame < first) first = region.firstFrame;
  return first;
}

function strikingMove(fighter: Readonly<Fighter>, world: Readonly<Roster> | undefined, shield: boolean, events: ImpactEvents): void {
  if (world === undefined) return;
  const { lastAttacker, lastAttackSerial } = fighter.hits;
  let character: Character | undefined;
  let move = -1;
  if (lastAttacker !== undefined && isActive(world, lastAttacker)) {
    const attacker = fighterAt(world, lastAttacker);
    if (attacker.attack.style !== undefined && attacker.attack.serial === lastAttackSerial) {
      character = attacker.character;
      move = attacker.attack.style;
    }
  }
  for (let slot = 0; slot < PARTICIPANT_CAPACITY && move < 0; slot++) {
    if (!isActive(world, slot)) continue;
    const attacker = fighterAt(world, slot);
    const struck = specialSoundMove(attacker.character, attacker.special.action);
    if (attacker === fighter || struck < 0) continue;
    for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) {
      const target = attacker.special.hitTargets[entry];
      if (target !== undefined && isActive(world, target) && fighterAt(world, target) === fighter) {
        character = attacker.character;
        move = struck;
      }
    }
  }
  if (character === undefined) {
    let nearest = PROJECTILE_REACH;
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      if (!isActive(world, slot)) continue;
      const owner = fighterAt(world, slot);
      if (owner === fighter) continue;
      for (const projectile of owner.projectiles) {
        const distance = f32(Math.abs(f32(projectile.x - fighter.motion.x)) + Math.abs(f32(projectile.z - f32(fighter.motion.z + PROJECTILE_BODY_Z))));
        if (projectile.serial === 0 || distance >= nearest) continue;
        nearest = distance;
        character = projectile.visualFamily;
        move = specialMove(projectile.kind === ProjectileKind.recoil ? 2 : projectile.kind === ProjectileKind.hero ? projectileSlot(projectile.visualFamily, projectile.spec) : 0);
      }
    }
  }
  if (character === undefined) return;
  if (shield) {
    events.shieldCharacter = character;
    events.shieldMove = move;
  } else {
    events.hitCharacter = character;
    events.hitMove = move;
  }
}

const CONTACT_BANDS: readonly number[] = [f32(0.2), 0.5, f32(0.85)];

function contactBandHeight(character: number, band: number): number {
  const body = hurtCapsule(character);
  return f32(f32(max(body.z1, body.z2) + body.radius) * (CONTACT_BANDS[band] ?? 0.5));
}

export function finishImpactEventsAfter(events: ImpactEvents, fighter: Readonly<Fighter>, world?: Readonly<Roster>, stage?: number, stageFrame = 0): void {
  const { motion, status, ground, surfaceRecovery, visuals, jump, launch, shield, down, attack, ledge, dodge } = fighter;
  events.character = fighter.character;
  events.facing = fighter.facing;
  events.x = motion.x;
  events.z = motion.z;
  events.direction = motion.x < events.previousX ? -1 : motion.x > events.previousX ? 1 : fighter.facing;
  events.respawn = events.previouslyOut && !status.out;
  if (!events.previouslyOut && status.out) {
    if (motion.x <= -SIDE_KO_X || motion.x >= SIDE_KO_X) events.koDirectionX = motion.x < 0.0 ? -1 : 1;
    else events.koDirectionZ = motion.z < 0.0 ? -1 : 1;
  }
  if (surfaceRecovery.contactSerial !== events.previousSurfaceContactSerial) {
    events.surface = surfaceRecovery.contactKind;
    events.contactX = surfaceRecovery.contactX;
    events.contactZ = surfaceRecovery.contactZ;
    events.normalX = surfaceRecovery.contactNormalX;
    events.normalZ = surfaceRecovery.contactNormalZ;
    events.surfaceMissedTech = (events.surface === SurfaceContact.wall || events.surface === SurfaceContact.ceiling) && isTumbling(fighter);
  }
  const present = !events.previouslyOut && !status.out;
  if (present) {
    events.grab = visuals.grab !== events.previousGrabVisualSerial;
    events.throwRelease = visuals.throw !== events.previousThrowVisualSerial;
    events.charge = !events.previouslyCharging && attack.smashCharging;
    events.ready = attack.smashCharging && events.previousChargeFrames < SMASH_MAX_CHARGE_FRAMES && attack.smashChargeFrames === SMASH_MAX_CHARGE_FRAMES;
    const built = lastBuiltSerial(fighter);
    events.jobDone = built >= 0 && built !== events.previousBuiltSerial;
    events.hoisted = fighter.grab.target !== undefined && fighter.grab.serial !== events.previousGrabSerial && fighter.grab.action === GrabAction.hoist;
    events.ledgeCatch = ledge.serial !== events.previousLedgeSerial;
    events.ledgeRecovery = events.previousLedgeState === LedgeState.hang
      && (ledge.state === LedgeState.climb || ledge.state === LedgeState.roll || ledge.state === LedgeState.attack || jump.serial !== events.previousJumpSerial);
    if (events.ledgeCatch) {
      events.ledgeX = f32(motion.x - f32(ledge.side * LEDGE_HANG_OUTSET));
      events.ledgeZ = f32(motion.z + LEDGE_HANG_DEPTH);
    } else if (events.ledgeRecovery) {
      events.ledgeX = f32(events.previousX - f32(events.previousLedgeSide * LEDGE_HANG_OUTSET));
      events.ledgeZ = f32(events.previousZ + LEDGE_HANG_DEPTH);
    }
  }
  events.hit = present && visuals.hit !== events.previousHitVisualSerial;
  events.electric = events.hit && visuals.hitElectric;
  events.element = visuals.hitElement;
  events.strength = visuals.hitStrength;
  events.tier = events.hit ? hitTier(fighter, world) ?? visuals.hitStrength : events.tier;
  events.variant = visuals.hit;
  events.pummel = events.hit && visuals.hitPummel;
  if (events.hit) events.hitZ = f32(motion.z + contactBandHeight(fighter.character, visuals.hitHeight));
  if (events.hit && !events.pummel) {
    events.strong = visuals.hitStrong;
    strikingMove(fighter, world, false, events);
  }
  if (present && events.previousFrozenFrames === 0 && status.frozenFrames > 0) {
    events.hit = true;
    events.element = HitElement.ice;
    events.electric = false;
    events.pummel = false;
    events.strength = 0;
    events.tier = 0;
    events.hitCharacter = Character.rifleman;
    events.hitMove = specialMove(specialSlot(SpecialAction.riflemanTrap));
    events.hitZ = f32(motion.z + contactBandHeight(fighter.character, 1));
  }

  const { style } = attack;
  const grab = style === AttackStyle.grab;
  if (present && style !== undefined && style !== AttackStyle.shot && (grab ? hasPerformSound(fighter.character, style) : !attack.dashGrab)
    && (attack.serial !== events.previousAttackSerial || attack.frame !== events.previousAttackFrame) && attack.frame === attackStartup(fighter, style)) {
    if (!grab) events.swing = moveTier(fighter.character, style);
    events.perform = style;
    events.performSerial = attack.serial;
  }
  const { special } = fighter;
  const slot = specialSlot(special.action);
  const started = special.action !== events.previousSpecialAction || special.frame < events.previousSpecialFrame || special.form !== events.previousSpecialForm;
  const aim = slot >= 0 ? runningHeroSpecial(fighter)?.heldOrb : undefined;
  if (present && slot >= 0 && (aim === undefined ? started : special.frame === aim.frame + 1 && (started || special.frame !== events.previousSpecialFrame))) {
    events.perform = specialMove(slot);
    events.performSerial = attack.serial + jump.serial + visuals.hit;
  }
  if (present && slot >= 0 && (special.action !== events.previousSpecialAction || special.frame !== events.previousSpecialFrame)
    && hasImpactSound(fighter.character, specialMove(slot)) && special.frame === firstRegionFrame(fighter)) {
    events.impact = specialMove(slot);
    if (events.perform < 0) events.performSerial = attack.serial + jump.serial + visuals.hit;
  }
  if (present) for (const projectile of fighter.projectiles) {
    if (projectile.kind !== ProjectileKind.hero || projectile.life !== FUSE_LEAD_FRAMES || projectile.serial === events.previousFuseSerial || projectile.spec?.expiresInto === undefined) continue;
    const move = specialMove(projectileSlot(fighter.character, projectile.spec));
    if (!hasFuseSound(fighter.character, move)) continue;
    events.fuse = move;
    events.fuseSerial = projectile.serial;
    events.fuseX = projectile.x;
    events.fuseZ = projectile.z;
    events.previousFuseSerial = projectile.serial;
  }
  events.shieldElectric = visuals.shieldElectric;
  events.shieldHit = present && visuals.shield !== events.previousShieldVisualSerial;
  events.shieldReflect = present && visuals.shieldReflect !== events.previousShieldReflectVisualSerial;
  if (events.shieldHit) {
    events.shieldVariant = visuals.shield;
    strikingMove(fighter, world, true, events);
  }
  events.shieldBreak = present && events.previousShieldBreak === ShieldBreak.none && shield.breakState !== ShieldBreak.none;
  events.ordinaryLanding = present && !events.previouslyGrounded && motion.grounded && down.state === DownState.none;
  detectPlatformCatch(events.platform, fighter, events.ordinaryLanding, stage, stageFrame);
  if (present && jump.serial !== events.previousJumpSerial && !events.ledgeRecovery) {
    events.jump = surfaceRecovery.state === SurfaceContact.techWall ? JumpCue.wall
      : jump.isDouble ? JumpCue.double : events.previouslyGrounded ? JumpCue.ground : JumpCue.air;
    if (events.jump === JumpCue.wall) {
      events.contactX = surfaceRecovery.contactX;
      events.contactZ = surfaceRecovery.contactZ;
      events.normalX = surfaceRecovery.contactNormalX;
      events.normalZ = surfaceRecovery.contactNormalZ;
    }
    events.jumpOriginX = events.previousX;
    events.jumpOriginZ = events.previousZ;
  }
  events.airDodge = present && !events.previouslyAirDodging && dodge.airDodging;
  if (present && launch.hitlag === 0) {
    const moved = Math.abs(f32(motion.x - events.previousX)) > f32(0.1) || Math.abs(f32(motion.z - events.previousZ)) > f32(0.1);
    if (motion.grounded && down.state === DownState.none && !isGroundDodging(fighter)) {
      const reversed = f32(events.previousVelocityX * motion.vx) < 0;
      const slowed = Math.abs(events.previousVelocityX) > f32(Math.abs(motion.vx) + f32(0.1));
      events.movementDust = (ground.dashFrame === 1 && events.previousDashFrame !== 1) || (moved && (reversed || slowed));
      events.runningDust = moved && Math.abs(motion.vx) > fighter.tuning.physics.walkSpeed;
      if (ground.dashFrame === 1 && events.previousDashFrame !== 1) events.footstep = "dash";
      else if (moved && attack.style === undefined && fighter.grab.target === undefined) {
        const cadence = events.runningDust ? 8 : 16;
        if (imod(ground.actionFrame, cadence) === 1) events.footstep = events.runningDust ? "run" : "walk";
      }
    }
    const groundDodgeStep = dodge.groundFrame > events.previousGroundDodge && imod(dodge.groundFrame, 4) === 0;
    const downRollStep = (down.state === DownState.roll || down.state === DownState.techRoll)
      && down.frame > events.previousDownFrame && imod(down.frame, 4) === 0;
    events.dodgeTrail = moved && (groundDodgeStep || downRollStep);
    events.launchTrail = !motion.grounded && isTumbling(fighter) && moved
      && down.frame > events.previousDownFrame && imod(down.frame, 3) === 0
      && f32(Math.abs(launch.knockbackX) + Math.abs(launch.knockbackZ)) > WORLD_UNITS_PER_MELEE_UNIT;
  }
  if (present && events.previousDown !== down.state) {
    if (isFloorTeching(fighter)) events.landing = ImpactLanding.tech;
    else if (down.state === DownState.bound) events.landing = ImpactLanding.missedTech;
    if (down.state === DownState.roll || down.state === DownState.techRoll) {
      events.dodge = DodgeCue.roll;
      events.direction = down.direction;
    }
  }
  if (present && events.previousGroundDodge === 0 && dodge.groundFrame > 0) {
    events.direction = dodge.groundDirection;
    events.dodge = events.direction === 0 ? DodgeCue.spot : DodgeCue.roll;
  }
}
