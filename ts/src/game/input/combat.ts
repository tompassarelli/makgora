import { AttackStyle } from "../sim/codes";
import type { Direction } from "./inputRow";


function sideAir(style: AttackStyle, facing: number, direction: number): AttackStyle {
  if (direction === 0) return style === AttackStyle.forwardSmash ? AttackStyle.neutralAir : AttackStyle.forwardAir;
  return direction === facing ? AttackStyle.forwardAir : AttackStyle.backAir;
}

export function attackStyleForGrounding(style: AttackStyle | undefined, grounded: boolean, facing: number, direction: number): AttackStyle | undefined {
  if (grounded || style === undefined || style === AttackStyle.shot) return style;
  switch (style) {
    case AttackStyle.jab: return AttackStyle.neutralAir;
    case AttackStyle.upSmash:
    case AttackStyle.upTilt:
    case AttackStyle.forwardTiltUp: return AttackStyle.upAir;
    case AttackStyle.downSmash:
    case AttackStyle.downTilt:
    case AttackStyle.forwardTiltDown: return AttackStyle.downAir;
    case AttackStyle.forwardSmash:
    case AttackStyle.forwardTilt: return sideAir(style, facing, direction);
    default: return undefined;
  }
}


export function groundDodgeIntent(shielding: boolean, left: boolean, right: boolean, down: boolean): Direction | undefined {
  if (!shielding) return undefined;
  if (down) return 0;
  return left === right ? undefined : left ? -1 : 1;
}

export function normalAttackStyle(horizontal: number, vertical: number, walking: boolean, strong: boolean, shieldGrab: boolean): AttackStyle {
  if (shieldGrab) return AttackStyle.grab;
  if (strong) return vertical > 0 ? AttackStyle.upSmash : vertical < 0 ? AttackStyle.downSmash : AttackStyle.forwardSmash;
  if (walking && horizontal !== 0) {
    if (vertical > 0) return AttackStyle.forwardTiltUp;
    if (vertical < 0) return AttackStyle.forwardTiltDown;
    return AttackStyle.forwardTilt;
  }
  if (vertical > 0) return AttackStyle.upTilt;
  if (vertical < 0) return AttackStyle.downTilt;
  if (horizontal !== 0) return AttackStyle.forwardTilt;
  return AttackStyle.jab;
}
