import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GroundAction, LedgeState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { analogShieldActive, analogShieldStrength } from "../sim/shield";
import { groundState } from "../sim/groundMovement";
import { isSmashAttack } from "../sim/moves";
import { squareRoot } from "../sim/warcraftMath";
import { MOD_X_UP_DIAGONAL, stickX, stickZ, tiltStickX, tiltStickZ } from "../sim/stick";
import { GroundOption, GroundState, SHIELD_DODGE_STICK_THRESHOLD, STICK_DEADZONE, groundOptionAllowed } from "../sim/stickZones";
import { Action, bit, has, maskOf } from "../input/actions";
import { type AttackBuffer, clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { groundDodgeIntent, normalAttackStyle } from "../input/combat";
import type { Direction, InputRow } from "../input/inputRow";

const ATTACK_BIT = bit(Action.attack);
const GRAB_BIT = bit(Action.grab);
const JUMP_BIT = bit(Action.jump);
const LEFT_TRIGGER_BIT = bit(Action.leftTrigger);
const LIGHT_SHIELD_BIT = bit(Action.lightShield);
const MOVE_DOWN_BIT = bit(Action.moveDown);
const MOVE_LEFT_BIT = bit(Action.moveLeft);
const MOVE_RIGHT_BIT = bit(Action.moveRight);
const MOVE_UP_BIT = bit(Action.moveUp);
const MOD_X_BIT = bit(Action.modX);
const RIGHT_TRIGGER_BIT = bit(Action.rightTrigger);
const SHORT_HOP_BIT = bit(Action.shortHop);
const C_DOWN_BIT = bit(Action.cDown);
const C_LEFT_BIT = bit(Action.cLeft);
const C_RIGHT_BIT = bit(Action.cRight);
const C_UP_BIT = bit(Action.cUp);
const SPECIAL_BIT = bit(Action.special);
const STRONG_BIT = bit(Action.strong);
const WALK_BIT = bit(Action.walk);
const GRAB_MASH_ACTIONS = maskOf(Action.attack, Action.special, Action.jump, Action.shortHop, Action.grab, Action.leftTrigger, Action.rightTrigger, Action.lightShield);
const MOVEMENT_ACTIONS = maskOf(Action.moveLeft, Action.moveRight, Action.moveDown, Action.moveUp);
const TRIGGERS = maskOf(Action.leftTrigger, Action.rightTrigger, Action.lightShield);
const C_STICK = maskOf(Action.cLeft, Action.cRight, Action.cUp, Action.cDown);

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

/** Whether the smash Strong + a direction aims may start from the fighter's ground state; up smash alone cancels jump squat. */
function strongSmashOpen(fighter: Readonly<Fighter>, style: AttackStyle): boolean {
  if (fighter.jump.squat > 0) return style === AttackStyle.upSmash;
  if (fighter.motion.crouching && fighter.ground.action !== GroundAction.none) return false;
  const state = groundState(fighter);
  const option = style === AttackStyle.upSmash ? GroundOption.upSmash : style === AttackStyle.downSmash ? GroundOption.downSmash : GroundOption.forwardSmash;
  // The sim advances the dash clock before it gates the attack, so the dash-smash window is judged on the next dash frame.
  const frame = state === GroundState.dash ? fighter.ground.actionFrame + 1 : fighter.ground.actionFrame;
  return groundOptionAllowed(state, frame, option, fighter.tuning.ground.runBrakeTurnCommandEndFrame);
}

/** Whether held Strong still holds the smash the fighter is charging: only while its starting direction stays aimed; a smash not begun yet follows Strong alone. */
function strongHoldsSmash(fighter: Readonly<Fighter>, aimX: number, aimZ: number): boolean {
  const style = fighter.attack.style;
  if (style === undefined || !isSmashAttack(style)) return true;
  if (normalAttackStyle(aimX, aimZ, false, true, false) !== style) return false;
  return style !== AttackStyle.forwardSmash || aimX === fighter.facing;
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
  if ((held & MOD_X_BIT) !== 0 && aimX !== 0 && aimZ > 0) {
    destination.diStickX = f32(aimX * MOD_X_UP_DIAGONAL.x);
    destination.diStickZ = MOD_X_UP_DIAGONAL.z;
    destination.driftStickX = destination.diStickX;
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
  destination.cStickX = ((held & C_RIGHT_BIT) !== 0 ? 1 : 0) - ((held & C_LEFT_BIT) !== 0 ? 1 : 0);
  destination.cStickZ = ((held & C_UP_BIT) !== 0 ? 1 : 0) - ((held & C_DOWN_BIT) !== 0 ? 1 : 0);
  const strong = ((held | pressed) & STRONG_BIT) !== 0;
  destination.specialPressed = (pressed & SPECIAL_BIT) !== 0;
  destination.ultimatePressed = ((pressed & SPECIAL_BIT) !== 0 && ((held | pressed) & ATTACK_BIT) !== 0) || ((pressed & ATTACK_BIT) !== 0 && (held & SPECIAL_BIT) !== 0);
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
  const state = groundState(fighter);
  const strongSmash = strong && fighter.motion.grounded && fighter.ledge.state === LedgeState.none && !destination.shieldTriggerActive && ((held | pressed) & SPECIAL_BIT) === 0;
  const strongAim = strongSmash && (state === GroundState.stand || (state === GroundState.crouch && fighter.ground.action === GroundAction.none));
  if (strongAim) {
    destination.direction = 0;
    destination.verticalDirection = 0;
    destination.diStickX = 0.0;
    destination.diStickZ = 0.0;
    destination.driftStickX = 0.0;
    destination.down = false;
  }
  const tiltDodge = !destination.shieldPressed && airborne && destination.shieldTriggerActive && (pressed & WALK_BIT) !== 0 && ((held | pressed) & C_STICK) === 0;
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
  destination.cStickUpFlick = (pressed & C_UP_BIT) !== 0;
  destination.cStickSideFlick = edgePair(pressed, Action.cLeft, Action.cRight);
  destination.attackHeld = (held & ATTACK_BIT) !== 0 || ((held & STRONG_BIT) !== 0 && strongHoldsSmash(fighter, aimX, aimZ));
  destination.specialHeld = (held & SPECIAL_BIT) !== 0;
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
  const strongAimed = strongSmash && (aimX !== 0 || aimZ !== 0) && (directionPressed || (pressed & STRONG_BIT) !== 0)
    && strongSmashOpen(fighter, normalAttackStyle(aimX, aimZ, false, true, false));
  if (destination.attackPressed || ((held & ATTACK_BIT) !== 0 && directionPressed) || strongAimed) {
    const shieldGrab = fighter.motion.grounded && (fighter.shield.raised || destination.shield);
    queueAttack(attacks, {
      style: normalAttackStyle(aimX, aimZ, destination.walking, strong, shieldGrab),
      facing: sign(aimX), frame, mayCharge: true, cStick: false,
    });
  }
  if ((pressed & GRAB_BIT) !== 0) queueAttack(attacks, { style: AttackStyle.grab, facing: 0, frame, mayCharge: false, cStick: false });
  if ((pressed & C_LEFT_BIT) !== 0) queueAttack(attacks, { style: AttackStyle.forwardTilt, facing: -1, frame, mayCharge: false, cStick: true });
  if ((pressed & C_RIGHT_BIT) !== 0) queueAttack(attacks, { style: AttackStyle.forwardTilt, facing: 1, frame, mayCharge: false, cStick: true });
  if ((pressed & C_UP_BIT) !== 0) queueAttack(attacks, { style: AttackStyle.upTilt, facing: 0, frame, mayCharge: false, cStick: true });
  if ((pressed & C_DOWN_BIT) !== 0) queueAttack(attacks, { style: AttackStyle.downTilt, facing: 0, frame, mayCharge: false, cStick: true });
}
