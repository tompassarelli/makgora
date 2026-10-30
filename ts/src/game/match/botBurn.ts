import { f32 } from "wisp/src/sim/f32";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { AttackStyle, DownState } from "../sim/codes";
import { canAttack, canShieldGrab, dashGrabStartup } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { attackDamage, attackDurationFramesForGrounding, attackStartupFrames } from "../sim/moves";
import type { Controls } from "../sim/roster";
import { SHIELD_MIN_HOLD_FRAMES, SHIELD_RELEASE_LAG_FRAMES, digitalShieldstunFrames } from "../sim/shield";
import { steerOnGround } from "./botFooting";
import { SHIELD_RESERVE } from "./botDefense";
import { moveReachAhead } from "./botMoves";
import { PunishKind, type PunishWindow, punishWindow } from "./botPunish";
import { BURN_MEMORY_FRAMES, BURN_REPEATS, type BotStrategy } from "./botStrategy";

const BURN_MARGIN = 30.0;
const BLOCK_PUNISH_FRAMES = 40;
const opening: PunishWindow = { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0, earliest: 0 };

export function burnedMove(state: Readonly<BotStrategy>, target: Readonly<Fighter>, frame: number, observationAge: number): AttackStyle | undefined {
  if (state.burnStyle === -1 || state.burnCount < BURN_REPEATS || frame - state.burnFrame > BURN_MEMORY_FRAMES + observationAge || target.character !== state.burnCharacter) return undefined;
  if (target.launch.hitstun > observationAge || target.down.state !== DownState.none || !target.motion.grounded) return undefined;
  return state.burnStyle;
}

function burnReach(state: Readonly<BotStrategy>, burned: AttackStyle, own: Readonly<Fighter>, target: Readonly<Fighter>): number {
  const reach = Math.max(moveReachAhead(target.character, burned, own, target.tuning.moves), state.burnGap);
  return f32(reach + (target.tuning.moves?.normals[burned]?.travelX ?? 0.0));
}

export function keepClearOfBurn(state: Readonly<BotStrategy>, burned: AttackStyle | undefined, own: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, frame: number, observationAge: number, matchFrame: number, input: Controls): boolean {
  if (burned === undefined || !own.motion.grounded) return false;
  if (punishWindow(target, frame, opening, observationAge, stage, matchFrame)) return true;
  const away = own.motion.x < target.motion.x ? -1 : 1;
  const edge = f32(burnReach(state, burned, own, target) + BURN_MARGIN);
  const closing = Math.max(0.0, f32(target.motion.vx * -away));
  const gap = f32(Math.abs(f32(own.motion.x - target.motion.x)) - f32(closing * observationAge));
  if (gap >= edge) return true;
  if (own.shield.energy > SHIELD_RESERVE && (own.shield.raised || canAttack(own))) input.shield = true;
  else steerOnGround(own, stage, f32(target.motion.x + f32(away * edge)), input);
  return true;
}

function blockedLagLeft(burned: AttackStyle, target: Readonly<Fighter>, sinceStun: number): number {
  const moves = target.tuning.moves;
  const damage = moves?.normals[burned]?.regions[0]?.hit.effect.damage ?? attackDamage(burned);
  const resumedAt = attackStartupFrames(burned, moves) + digitalShieldstunFrames(damage);
  return attackDurationFramesForGrounding(burned, true, moves) - 1 - resumedAt - sinceStun;
}

export function punishBlockedBurn(state: BotStrategy, burned: AttackStyle | undefined, own: Readonly<Fighter>, target: Readonly<Fighter>, frame: number, input: Controls, commands: AttackBuffer): boolean {
  if (own.shield.stun > 0) state.blockFrame = frame;
  if (burned === undefined || !own.motion.grounded || state.blockFrame < 0 || frame - state.blockFrame > BLOCK_PUNISH_FRAMES) return false;
  if (own.shield.stun > 0) {
    input.shield = true;
    return true;
  }
  const left = blockedLagLeft(burned, target, frame - state.blockFrame);
  const toward = target.motion.x < own.motion.x ? -1 : 1;
  const gap = Math.abs(f32(own.motion.x - target.motion.x));
  const grabReach = moveReachAhead(own.character, AttackStyle.grab, target, own.tuning.moves);
  const dashSpeed = own.tuning.physics.dashSpeed;
  if (own.shield.raised) {
    if (canShieldGrab(own) && gap <= grabReach) {
      queueAttack(commands, { style: AttackStyle.grab, facing: toward, frame, mayCharge: false, cStick: false });
      input.shield = true;
      return true;
    }
    const release = Math.max(0, SHIELD_MIN_HOLD_FRAMES - own.shield.heldFrames) + SHIELD_RELEASE_LAG_FRAMES;
    const run = Math.ceil(f32(Math.max(0.0, f32(gap - grabReach)) / dashSpeed));
    if (left < release + run + dashGrabStartup(own)) return false;
    input.shield = false;
    return true;
  }
  if (own.shield.releaseLag > 0) return left > 0;
  if (!canAttack(own) || left < dashGrabStartup(own)) return false;
  if (own.ground.dashFrame > 0 && gap <= f32(grabReach + f32(dashSpeed * dashGrabStartup(own)))) {
    queueAttack(commands, { style: AttackStyle.grab, facing: toward, frame, mayCharge: false, cStick: false });
    return true;
  }
  input.walking = false;
  input.direction = toward;
  return true;
}
