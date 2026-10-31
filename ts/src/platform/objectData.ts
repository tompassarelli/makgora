import { FILE_IO_OBJECT, type FighterObject } from "../game/objectData";
import { Body, setAbilityTooltip, setBodyAttackCooldown, setBodyBlendTime, setBodyMoveSpeed, setBodyName, setBodyScale, setBodySelectionScale } from "wisp/game/bodies";


export function applyFighterObject(whichUnit: Body, definition: FighterObject): void {
  setBodyName(whichUnit, definition.name);
  setBodyScale(whichUnit, definition.scale, definition.scale, definition.scale);
  setBodyBlendTime(whichUnit, definition.blendTime);
  setBodySelectionScale(whichUnit, definition.selectionScale);
  setBodyMoveSpeed(whichUnit, definition.moveSpeed);
  setBodyAttackCooldown(whichUnit, definition.attackCooldown);
}


export function applyFileIoObject(): void {
  for (let level = 0; level < FILE_IO_OBJECT.levels; level++) {
    setAbilityTooltip(FILE_IO_OBJECT.id, FILE_IO_OBJECT.tooltip, level);
  }
}
