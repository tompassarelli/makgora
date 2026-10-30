import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { floorDiv, imod } from "wisp/src/sim/intMath";
import { type AttackBuffer, type AttackCommand, clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { MURLOC_DUO } from "../fighters/murloc/duo";
import { canStartAttack } from "../sim/conditions";
import { advanceTossCooldown } from "../sim/duoToss";
import { canHit } from "../sim/teams";
import { DuoOrder, DuoRole } from "../sim/codes";
import type { Duo, Fighter } from "../sim/fighter";
import { type Controls, type Roster, copyControls, fighterAt, isActive, neutralControls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight, mainDeckZ } from "../sim/stage";
import { steerOnGround } from "./botFooting";
import { useMatchSeed } from "./botRandom";
import { chooseRecoveryInput } from "./botRecovery";
import type { FrameControls } from "./controls";

export const RING_FRAMES = 8;
export const WORDS_PER_FRAME = 4;

const NEUTRAL = neutralControls();
const queued: { -readonly [Field in keyof AttackCommand]: AttackCommand[Field] } = { style: 0, facing: 0, frame: 0, mayCharge: false, cStick: false };

const STICK_STEPS = 127;

const SPECIAL = 1 << 0;
const ULTIMATE = 1 << 1;
const DOWN = 1 << 2;
const SHIELD = 1 << 3;
const SHIELD_PRESSED = 1 << 4;
const SHIELD_TRIGGER = 1 << 5;
const JUMP = 1 << 6;
const SHORT_HOP = 1 << 7;
const AIR_DODGE = 1 << 8;
const TECH = 1 << 9;
const MASH = 1 << 10;
const ATTACK_PRESSED = 1 << 11;
const GRAB_MASH = 1 << 12;
const GROUND_DODGE = 1 << 13;
const GETUP_ATTACK = 1 << 14;
const GETUP_STAND = 1 << 15;
const GETUP_DIRECTION = 1 << 16;
const C_STICK_UP_FLICK = 1 << 17;
const JUMP_HELD = 1 << 18;
const WALKING = 1 << 19;
const ATTACK_HELD = 1 << 20;
const SPECIAL_HELD = 1 << 21;
const DI_VALID = 1 << 22;
const SDI_PULSE = 1 << 23;
const DRIFT_DEFINED = 1 << 24;
const C_STICK_X_SHIFT = 25;
const C_STICK_Z_SHIFT = 27;

const DRIFT_SHIFT = 16;
const SHIELD_STRENGTH_SHIFT = 24;
const STICK_Z_SHIFT = 8;

const COMMAND_PRESENT = 1 << 0;
const COMMAND_STYLE_SHIFT = 1;
const COMMAND_FACING_SHIFT = 5;
const COMMAND_MAY_CHARGE = 1 << 7;
const COMMAND_C_STICK = 1 << 8;

const field = (word: number, shift: number, mask: number): number => floorDiv(word, 1 << shift) & mask;
const bit = (value: boolean, mask: number): number => value ? mask : 0;
const has = (word: number, mask: number): boolean => (word & mask) !== 0;
const trit = (value: number): number => value > 0 ? 1 : value < 0 ? 2 : 0;
const untrit = (word: number, shift: number): number => {
  const code = field(word, shift, 3);
  return code === 1 ? 1 : code === 2 ? -1 : 0;
};

function quantise(value: number): number {
  const steps = Math.floor(value * STICK_STEPS + 0.5);
  return steps > STICK_STEPS ? STICK_STEPS : steps < -STICK_STEPS ? -STICK_STEPS : steps;
}

const stickByte = (value: number): number => quantise(value) & 255;
const stickValue = (word: number, shift: number): number => {
  const stored = field(word, shift, 255);
  return f32((stored >= 128 ? stored - 256 : stored) / STICK_STEPS);
};

function packFlags(c: Readonly<Controls>): number {
  return bit(c.specialPressed, SPECIAL) | bit(c.ultimatePressed, ULTIMATE) | bit(c.down, DOWN) | bit(c.shield, SHIELD)
    | bit(c.shieldPressed, SHIELD_PRESSED) | bit(c.shieldTriggerActive, SHIELD_TRIGGER) | bit(c.jumpPressed, JUMP)
    | bit(c.shortHopPressed, SHORT_HOP) | bit(c.airDodgePressed, AIR_DODGE) | bit(c.techPressed, TECH) | bit(c.mashPressed, MASH)
    | bit(c.attackPressed, ATTACK_PRESSED) | bit(c.grabMashPressed, GRAB_MASH) | bit(c.groundDodgePressed, GROUND_DODGE)
    | bit(c.getupAttackPressed, GETUP_ATTACK) | bit(c.getupStandPressed, GETUP_STAND) | bit(c.getupDirectionPressed, GETUP_DIRECTION)
    | bit(c.cStickUpFlick, C_STICK_UP_FLICK) | bit(c.jumpHeld, JUMP_HELD) | bit(c.walking, WALKING) | bit(c.attackHeld, ATTACK_HELD)
    | bit(c.specialHeld, SPECIAL_HELD) | bit(c.diStickValid, DI_VALID) | bit(c.sdiPulse, SDI_PULSE)
    | bit(c.driftStickX !== undefined, DRIFT_DEFINED) | (trit(c.cStickX) << C_STICK_X_SHIFT) | (trit(c.cStickZ) << C_STICK_Z_SHIFT);
}

function packSticks(c: Readonly<Controls>): number {
  return stickByte(c.diStickX) | (stickByte(c.diStickZ) << STICK_Z_SHIFT) | (stickByte(c.driftStickX ?? 0) << DRIFT_SHIFT)
    | ((STICK_STEPS - quantise(c.shieldStrength)) << SHIELD_STRENGTH_SHIFT);
}

function packDirections(c: Readonly<Controls>): number {
  return trit(c.specialX) | (trit(c.specialZ) << 2) | (trit(c.dodgeX) << 4) | (trit(c.dodgeZ) << 6) | (trit(c.sdiX) << 8)
    | (trit(c.sdiZ) << 10) | (trit(c.ledgeVerticalPressed) << 12) | (trit(c.grabThrowX) << 14) | (trit(c.grabThrowZ) << 16)
    | (trit(c.groundDodgeDirection) << 18) | (trit(c.getupDirection) << 20) | (trit(c.cStickSideFlick) << 22)
    | (trit(c.direction) << 24) | (trit(c.verticalDirection) << 26);
}

/** Writes a leader frame at `base`: the controls and the command queued on `frame`; `attackRequested` and `resetPressed` belong to the body that reads them. */
export function packFrame(ring: number[], base: number, controls: Readonly<Controls>, commands: Readonly<AttackBuffer>, frame: number): void {
  const command = commands.pending;
  ring[base] = packFlags(controls);
  ring[base + 1] = packSticks(controls);
  ring[base + 2] = packDirections(controls);
  ring[base + 3] = command === undefined || command.frame !== frame ? 0
    : COMMAND_PRESENT | (command.style << COMMAND_STYLE_SHIFT) | (trit(command.facing) << COMMAND_FACING_SHIFT)
      | bit(command.mayCharge, COMMAND_MAY_CHARGE) | bit(command.cStick, COMMAND_C_STICK);
}

function clearFrame(ring: number[], base: number): void {
  ring[base] = 0;
  ring[base + 1] = 0;
  ring[base + 2] = 0;
  ring[base + 3] = 0;
}

const flip = (value: number): number => 0 - value;

function mirrorSides(controls: Controls): void {
  controls.specialX = flip(controls.specialX);
  controls.dodgeX = flip(controls.dodgeX);
  controls.sdiX = flip(controls.sdiX);
  controls.grabThrowX = flip(controls.grabThrowX);
  controls.groundDodgeDirection = flip(controls.groundDodgeDirection);
  controls.getupDirection = flip(controls.getupDirection);
  controls.cStickX = flip(controls.cStickX);
  controls.cStickSideFlick = flip(controls.cStickSideFlick);
}

/** Reads the frame at `base` into a partner's controls, and queues its command on `frame` so the attack buffer's grace covers a press the partner cannot start yet. */
export function unpackFrame(ring: readonly number[], base: number, controls: Controls, commands: AttackBuffer, frame: number, mirror = false): void {
  const flags = at(ring, base);
  const sticks = at(ring, base + 1);
  const directions = at(ring, base + 2);
  const command = at(ring, base + 3);
  controls.specialPressed = has(flags, SPECIAL);
  controls.ultimatePressed = has(flags, ULTIMATE);
  controls.down = has(flags, DOWN);
  controls.shield = has(flags, SHIELD);
  controls.shieldPressed = has(flags, SHIELD_PRESSED);
  controls.shieldTriggerActive = has(flags, SHIELD_TRIGGER);
  controls.jumpPressed = has(flags, JUMP);
  controls.shortHopPressed = has(flags, SHORT_HOP);
  controls.airDodgePressed = has(flags, AIR_DODGE);
  controls.techPressed = has(flags, TECH);
  controls.mashPressed = has(flags, MASH);
  controls.attackPressed = has(flags, ATTACK_PRESSED);
  controls.grabMashPressed = has(flags, GRAB_MASH);
  controls.groundDodgePressed = has(flags, GROUND_DODGE);
  controls.getupAttackPressed = has(flags, GETUP_ATTACK);
  controls.getupStandPressed = has(flags, GETUP_STAND);
  controls.getupDirectionPressed = has(flags, GETUP_DIRECTION);
  controls.cStickUpFlick = has(flags, C_STICK_UP_FLICK);
  controls.jumpHeld = has(flags, JUMP_HELD);
  controls.walking = has(flags, WALKING);
  controls.attackHeld = has(flags, ATTACK_HELD);
  controls.specialHeld = has(flags, SPECIAL_HELD);
  controls.diStickValid = has(flags, DI_VALID);
  controls.sdiPulse = has(flags, SDI_PULSE);
  controls.cStickX = untrit(flags, C_STICK_X_SHIFT);
  controls.cStickZ = untrit(flags, C_STICK_Z_SHIFT);
  controls.diStickX = stickValue(sticks, 0);
  controls.diStickZ = stickValue(sticks, STICK_Z_SHIFT);
  controls.driftStickX = has(flags, DRIFT_DEFINED) ? stickValue(sticks, DRIFT_SHIFT) : undefined;
  controls.shieldStrength = f32((STICK_STEPS - field(sticks, SHIELD_STRENGTH_SHIFT, 127)) / STICK_STEPS);
  controls.specialX = untrit(directions, 0);
  controls.specialZ = untrit(directions, 2);
  controls.dodgeX = untrit(directions, 4);
  controls.dodgeZ = untrit(directions, 6);
  controls.sdiX = untrit(directions, 8);
  controls.sdiZ = untrit(directions, 10);
  controls.ledgeVerticalPressed = untrit(directions, 12);
  controls.grabThrowX = untrit(directions, 14);
  controls.grabThrowZ = untrit(directions, 16);
  controls.groundDodgeDirection = untrit(directions, 18);
  controls.getupDirection = untrit(directions, 20);
  controls.cStickSideFlick = untrit(directions, 22);
  controls.direction = untrit(directions, 24);
  controls.verticalDirection = untrit(directions, 26);
  controls.attackRequested = false;
  controls.resetPressed = false;
  if (mirror) mirrorSides(controls);
  if (!has(command, COMMAND_PRESENT)) return;
  queued.style = field(command, COMMAND_STYLE_SHIFT, 15);
  queued.facing = (mirror ? flip(untrit(command, COMMAND_FACING_SHIFT)) : untrit(command, COMMAND_FACING_SHIFT)) as AttackCommand["facing"];
  queued.frame = frame;
  queued.mayCharge = has(command, COMMAND_MAY_CHARGE);
  queued.cStick = has(command, COMMAND_C_STICK);
  queueAttack(commands, queued);
}

const offstage = (f: Readonly<Fighter>, stage: number): boolean =>
  !f.motion.grounded && (f.motion.x < mainDeckLeft(stage) || f.motion.x > mainDeckRight(stage) || f.motion.z < mainDeckZ(stage));

const standsOnStage = (f: Readonly<Fighter>, stage: number): boolean =>
  f.motion.grounded && f.motion.x >= mainDeckLeft(stage) && f.motion.x <= mainDeckRight(stage);

const gapBetween = (a: Readonly<Fighter>, b: Readonly<Fighter>): number => Math.abs(f32(a.motion.x - b.motion.x));

const separates = (partner: Readonly<Fighter>, leader: Readonly<Fighter>, stage: number): boolean =>
  gapBetween(partner, leader) > MURLOC_DUO.separateDistance || (offstage(partner, stage) && standsOnStage(leader, stage));

const reunited = (partner: Readonly<Fighter>, leader: Readonly<Fighter>, stage: number): boolean =>
  gapBetween(partner, leader) <= MURLOC_DUO.resyncDistance && !separates(partner, leader, stage) && canStartAttack(partner) && canStartAttack(leader);

const facingOf = (value: number): number => value < 0 ? -1 : 1;

/** Moves the order between copy, hold, regroup, separated and tossed, which ends on landing in hold or falling away separated; the others belong to the specials that set them. */
function advanceOrder(duo: Duo, partner: Fighter, leader: Readonly<Fighter>, stage: number): void {
  const { order } = duo;
  if (order !== DuoOrder.copy && order !== DuoOrder.separated && order !== DuoOrder.hold && order !== DuoOrder.regroup && order !== DuoOrder.tossed) return;
  duo.orderFrame++;
  let next: DuoOrder = order;
  if (order === DuoOrder.tossed) {
    if (partner.motion.grounded) {
      next = DuoOrder.hold;
      partner.motion.vx = 0.0;
    }
    else if (partner.status.out || partner.launch.hitstun > 0 || partner.motion.z < mainDeckZ(stage)) next = DuoOrder.separated;
  } else if (order === DuoOrder.copy) {
    if (separates(partner, leader, stage)) next = DuoOrder.separated;
  } else if (order === DuoOrder.hold) {
    if (offstage(partner, stage) && standsOnStage(leader, stage)) next = DuoOrder.separated;
    else if (duo.orderFrame >= MURLOC_DUO.holdFrames) next = DuoOrder.regroup;
  } else if (reunited(partner, leader, stage)) next = DuoOrder.copy;
  if (next === order) return;
  duo.order = next;
  duo.orderFrame = 0;
}

/** The nearest foe by x decides which way a held partner faces; a foe level with it, or none, leaves the leader's facing. */
function holdFacing(world: Roster, slot: number, partner: Readonly<Fighter>, leader: Readonly<Fighter>): number {
  let best = Infinity;
  let side = 0;
  for (const other of PARTICIPANT_SLOTS) {
    if (other === slot || !isActive(world, other) || !canHit(world, slot, other)) continue;
    const foe = fighterAt(world, other);
    if (foe.status.out) continue;
    const dx = f32(foe.motion.x - partner.motion.x);
    const gap = Math.abs(dx);
    if (gap < best) {
      best = gap;
      side = dx < 0 ? -1 : 1;
    } else if (gap === best && side !== (dx < 0 ? -1 : 1)) side = 0;
  }
  return side === 0 || best === 0 ? leader.facing : side;
}

/** A held partner copies the leader in place: no walk, run or drift, its left and right turned to face the nearest foe. */
function driveHeld(world: Roster, slot: number, partner: Fighter, leader: Readonly<Fighter>, ring: readonly number[], controls: FrameControls, read: number, frame: number): void {
  if (partner.motion.grounded && canStartAttack(partner)) partner.facing = facingOf(holdFacing(world, slot, partner, leader));
  const input = at(controls.inputs, slot);
  unpackFrame(ring, read, input, at(controls.commands, slot), frame, partner.facing !== leader.facing);
  input.diStickX = 0.0;
  input.driftStickX = 0.0;
  input.direction = 0;
  input.walking = false;
}

/** A separated partner recovers by the bots' full-skill chooser, which reads only the fighter's state once the salt is 0, then walks or hops to the leader. */
function driveSeparated(partner: Readonly<Fighter>, leader: Readonly<Fighter>, input: Controls, stage: number, stageFrame: number): void {
  copyControls(input, NEUTRAL);
  if (partner.status.out) return;
  useMatchSeed(0);
  if (chooseRecoveryInput(partner, stage, stageFrame, input)) return;
  const dx = f32(leader.motion.x - partner.motion.x);
  const dz = f32(leader.motion.z - partner.motion.z);
  if (!partner.motion.grounded) {
    input.direction = dx < 0 ? -1 : 1;
    return;
  }
  steerOnGround(partner, stage, leader.motion.x, input);
  if (partner.jump.squat > 0) {
    input.jumpHeld = dz > MURLOC_DUO.hopHeight;
    return;
  }
  if (dz > MURLOC_DUO.hopHeight && Math.abs(dx) < MURLOC_DUO.hopReach) {
    input.jumpPressed = true;
    input.jumpHeld = true;
  }
}

/** Before the status mask each frame, every partner in the copy or hold order takes its leader's controls from MURLOC_DUO.delayFrames ago (a held one in place, facing the nearest foe), takes neutral controls while the leader holds a foe, and in the separated and regroup orders drives itself. */
export function drivePartners(world: Roster, controls: FrameControls, frame: number, stage: number, stageFrame: number): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const partner = fighterAt(world, slot);
    const { duo } = partner;
    if (duo === undefined || duo.role !== DuoRole.partner || !isActive(world, duo.link)) continue;
    const leader = fighterAt(world, duo.link);
    advanceTossCooldown(leader);
    if (duo.swapCooldown > 0) duo.swapCooldown--;
    if (leader.duo !== undefined && leader.duo.swapCooldown > 0) leader.duo.swapCooldown--;
    advanceOrder(duo, partner, leader, stage);
    const holding = leader.grab.target !== undefined;
    const write = duo.head * WORDS_PER_FRAME;
    if (holding) clearFrame(duo.ring, write);
    else packFrame(duo.ring, write, at(controls.inputs, duo.link), at(controls.commands, duo.link), frame);
    const read = imod(duo.head + RING_FRAMES - MURLOC_DUO.delayFrames, RING_FRAMES) * WORDS_PER_FRAME;
    duo.head = imod(duo.head + 1, RING_FRAMES);
    if (duo.order === DuoOrder.separated || duo.order === DuoOrder.regroup) {
      driveSeparated(partner, leader, controls.inputs[slot], stage, stageFrame);
      clearAttackBuffer(controls.commands[slot]);
    } else if (holding || (duo.order !== DuoOrder.copy && duo.order !== DuoOrder.hold)) {
      copyControls(controls.inputs[slot], NEUTRAL);
      clearAttackBuffer(controls.commands[slot]);
    } else if (duo.order === DuoOrder.hold) driveHeld(world, slot, partner, leader, duo.ring, controls, read, frame);
    else unpackFrame(duo.ring, read, controls.inputs[slot], controls.commands[slot], frame);
  }
}
