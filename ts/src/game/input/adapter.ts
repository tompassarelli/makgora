import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, LedgeState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { analogShieldActive, analogShieldStrength } from "../sim/shield";
import { squareRoot } from "../sim/warcraftMath";
import { stickX, stickZ, tiltStickX, tiltStickZ } from "../sim/stick";
import { SHIELD_DODGE_STICK_THRESHOLD, STICK_DEADZONE } from "../sim/stickZones";
import { Action, bit, has, maskOf } from "./actions";
import { type AttackBuffer, clearAttackBuffer, queueAttack } from "./attackBuffer";
import { groundDodgeIntent, normalAttackStyle } from "./combat";
import type { Direction, InputRow } from "./inputRow";

const ATTACK_BIT = bit(Action.attack);
const GRAB_BIT = bit(Action.grab);
const JUMP_BIT = bit(Action.jump);
const LEFT_TRIGGER_BIT = bit(Action.leftTrigger);
const LIGHT_SHIELD_BIT = bit(Action.lightShield);
const MOVE_DOWN_BIT = bit(Action.moveDown);
const MOVE_LEFT_BIT = bit(Action.moveLeft);
const MOVE_RIGHT_BIT = bit(Action.moveRight);
const MOVE_UP_BIT = bit(Action.moveUp);
const RIGHT_TRIGGER_BIT = bit(Action.rightTrigger);
const SHORT_HOP_BIT = bit(Action.shortHop);
const SMASH_DOWN_BIT = bit(Action.smashDown);
const SMASH_LEFT_BIT = bit(Action.smashLeft);
const SMASH_RIGHT_BIT = bit(Action.smashRight);
const SMASH_UP_BIT = bit(Action.smashUp);
const SPECIAL_BIT = bit(Action.special);
const STRONG_BIT = bit(Action.strong);
const WALK_BIT = bit(Action.walk);
const GRAB_MASH_ACTIONS = maskOf(Action.attack, Action.special, Action.jump, Action.shortHop, Action.grab, Action.leftTrigger, Action.rightTrigger, Action.lightShield);
const MOVEMENT_ACTIONS = maskOf(Action.moveLeft, Action.moveRight, Action.moveDown, Action.moveUp);
const TRIGGERS = maskOf(Action.leftTrigger, Action.rightTrigger, Action.lightShield);
const SMASHES = maskOf(Action.smashLeft, Action.smashRight, Action.smashUp, Action.smashDown);

const sign = (value: number): Direction => value < 0 ? -1 : value > 0 ? 1 : 0;

function edgePair(pressed: number, negative: Action, positive: Action): Direction {
  const left = has(pressed, negative);
  const right = has(pressed, positive);
  return left === right ? 0 : right ? 1 : -1;
}

function movementAxis(row: Readonly<InputRow>, negative: Action, positive: Action, axis: number): Direction {


  if (has(row.held, negative) || has(row.held, positive) || axis !== 0) return f32(Math.abs(axis) / 127.0) < STICK_DEADZONE ? 0 : sign(axis);
  return edgePair(row.pressed, negative, positive);
}


export function adaptInput(row: Readonly<InputRow>, fighter: Readonly<Fighter>, frame: number, destination: Controls, attacks: AttackBuffer): void {
  const { held, pressed } = row;
  clearAttackBuffer(attacks);
  destination.attackRequested = false;
  const aimX = movementAxis(row, Action.moveLeft, Action.moveRight, row.axisX);
  const aimZ = movementAxis(row, Action.moveDown, Action.moveUp, row.axisZ);
  destination.direction = aimX;
  destination.verticalDirection = aimZ;
  destination.diStickValid = true;
  destination.diStickX = f32(row.axisX / 127.0);
  destination.driftStickX = destination.diStickX;
  destination.diStickZ = f32(row.axisZ / 127.0);
  const length = squareRoot(f32(f32(destination.diStickX * destination.diStickX) + f32(destination.diStickZ * destination.diStickZ)));
  if (length > 1) {
    destination.diStickX = f32(destination.diStickX / length);
    destination.diStickZ = f32(destination.diStickZ / length);
  }
  destination.walking = (held & WALK_BIT) !== 0;
  if (destination.walking) {
    destination.diStickX = tiltStickX(destination.diStickX);
    destination.diStickZ = tiltStickZ(destination.diStickZ);
    destination.driftStickX = tiltStickX(destination.driftStickX);
  }
  destination.sdiPulse = row.sdi;
  destination.sdiX = row.sdiX;
  destination.sdiZ = row.sdiZ;
  destination.cStickX = ((held & SMASH_RIGHT_BIT) !== 0 ? 1 : 0) - ((held & SMASH_LEFT_BIT) !== 0 ? 1 : 0);
  destination.cStickZ = ((held & SMASH_UP_BIT) !== 0 ? 1 : 0) - ((held & SMASH_DOWN_BIT) !== 0 ? 1 : 0);
  const strong = ((held | pressed) & STRONG_BIT) !== 0;
  destination.specialPressed = (pressed & SPECIAL_BIT) !== 0;
  destination.ultimatePressed = ((pressed & SPECIAL_BIT) !== 0 && ((held | pressed) & ATTACK_BIT) !== 0) || ((pressed & ATTACK_BIT) !== 0 && (held & SPECIAL_BIT) !== 0);
  destination.exPressed = destination.specialPressed && strong && !destination.ultimatePressed;
  destination.specialX = destination.specialPressed && !((held & WALK_BIT) !== 0 && row.specialZ === 0) ? row.specialX : 0;
  destination.specialZ = destination.specialPressed ? row.specialZ : 0;
  destination.down = (held & MOVE_DOWN_BIT) !== 0 && (held & WALK_BIT) === 0;
  destination.shieldPressed = (pressed & TRIGGERS) !== 0;
  const leftPressure = row.triggerLeft > 0 ? row.triggerLeft : ((held | pressed) & LEFT_TRIGGER_BIT) !== 0 ? 255 : ((held | pressed) & LIGHT_SHIELD_BIT) !== 0 ? 77 : 0;
  const rightPressure = row.triggerRight > 0 ? row.triggerRight : ((held | pressed) & RIGHT_TRIGGER_BIT) !== 0 ? 255 : 0;
  const pressure = Math.max(leftPressure, rightPressure);
  destination.shieldTriggerActive = pressure > 0;
  destination.shield = pressure === 255 || analogShieldActive(pressure);
  destination.shieldStrength = pressure === 255 ? 1.0 : analogShieldStrength(pressure);
  destination.shortHopPressed = (pressed & SHORT_HOP_BIT) !== 0;
  destination.jumpPressed = (pressed & JUMP_BIT) !== 0 || destination.shortHopPressed;
  destination.jumpHeld = (held & JUMP_BIT) !== 0;
  destination.techPressed = destination.shieldPressed;
  const airborne = (fighter.jump.squat > 0 || !fighter.motion.grounded) && fighter.ledge.state === LedgeState.none;
  const standing = fighter.motion.grounded && fighter.ledge.state === LedgeState.none;
  const strongAim = strong && standing && !destination.shieldTriggerActive && ((held | pressed) & SPECIAL_BIT) === 0;
  if (strongAim) {
    destination.direction = 0;
    destination.verticalDirection = 0;
    destination.diStickX = 0.0;
    destination.diStickZ = 0.0;
    destination.driftStickX = 0.0;
    destination.down = false;
  }
  const tiltDodge = !destination.shieldPressed && airborne && destination.shieldTriggerActive && (pressed & WALK_BIT) !== 0 && ((held | pressed) & SMASHES) === 0;
  destination.airDodgePressed = destination.shieldPressed || tiltDodge;
  destination.dodgeX = destination.shieldPressed ? row.dodgeX : tiltDodge ? destination.direction : 0;
  destination.dodgeZ = destination.shieldPressed ? row.dodgeZ : tiltDodge ? destination.verticalDirection : 0;
  destination.mashPressed = pressed !== 0;
  destination.attackPressed = (pressed & ATTACK_BIT) !== 0;
  destination.grabMashPressed = (pressed & GRAB_MASH_ACTIONS) !== 0;
  destination.grabThrowX = sign(row.throwX);
  destination.grabThrowZ = sign(row.throwZ);
  destination.ledgeVerticalPressed = row.ledgeVertical;
  destination.getupAttackPressed = destination.attackPressed || destination.specialPressed;
  destination.getupStandPressed = (pressed & MOVE_UP_BIT) !== 0 || destination.jumpPressed || destination.airDodgePressed;
  destination.getupDirection = edgePair(pressed, Action.moveLeft, Action.moveRight);
  destination.getupDirectionPressed = destination.getupDirection !== 0;
  destination.cStickUpFlick = (pressed & SMASH_UP_BIT) !== 0;
  destination.cStickSideFlick = edgePair(pressed, Action.smashLeft, Action.smashRight);
  destination.attackHeld = (held & (ATTACK_BIT | STRONG_BIT)) !== 0;
  const leftShield = (held & LEFT_TRIGGER_BIT) !== 0 || analogShieldActive(row.triggerLeft);
  const rightShield = (held & RIGHT_TRIGGER_BIT) !== 0 || analogShieldActive(row.triggerRight);
  destination.resetPressed = leftShield && rightShield && destination.attackPressed;

  const dodge = groundDodgeIntent(destination.shield,
    (pressed & MOVE_LEFT_BIT) !== 0 && stickX(destination) <= -SHIELD_DODGE_STICK_THRESHOLD,
    (pressed & MOVE_RIGHT_BIT) !== 0 && stickX(destination) >= SHIELD_DODGE_STICK_THRESHOLD,
    (pressed & MOVE_DOWN_BIT) !== 0 && stickZ(destination) <= -SHIELD_DODGE_STICK_THRESHOLD);
  destination.groundDodgePressed = dodge !== undefined;
  destination.groundDodgeDirection = dodge ?? 0;

  const directionPressed = (pressed & MOVEMENT_ACTIONS) !== 0;
  const strongAimed = strongAim && (aimX !== 0 || aimZ !== 0) && (directionPressed || (pressed & STRONG_BIT) !== 0);
  if (destination.attackPressed || ((held & ATTACK_BIT) !== 0 && directionPressed) || strongAimed) {
    const shieldGrab = fighter.motion.grounded && (fighter.shield.raised || destination.shield);
    queueAttack(attacks, {
      style: normalAttackStyle(aimX, aimZ, destination.walking, strong, shieldGrab),
      facing: sign(aimX), frame, mayCharge: true,
    });
  }
  if ((pressed & GRAB_BIT) !== 0) queueAttack(attacks, { style: AttackStyle.grab, facing: 0, frame, mayCharge: false });
  const tilt = destination.walking;
  if ((pressed & SMASH_LEFT_BIT) !== 0) queueAttack(attacks, { style: tilt ? AttackStyle.forwardTilt : AttackStyle.forwardSmash, facing: -1, frame, mayCharge: false });
  if ((pressed & SMASH_RIGHT_BIT) !== 0) queueAttack(attacks, { style: tilt ? AttackStyle.forwardTilt : AttackStyle.forwardSmash, facing: 1, frame, mayCharge: false });
  if ((pressed & SMASH_UP_BIT) !== 0) queueAttack(attacks, { style: tilt ? AttackStyle.upTilt : AttackStyle.upSmash, facing: 0, frame, mayCharge: false });
  if ((pressed & SMASH_DOWN_BIT) !== 0) queueAttack(attacks, { style: tilt ? AttackStyle.downTilt : AttackStyle.downSmash, facing: 0, frame, mayCharge: false });
}
