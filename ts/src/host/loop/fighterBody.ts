

import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import type { CostumeTint } from "../../game/presentation/model/costume";
import { ShieldBreak } from "../../game/sim/codes";
import { fighterPoseFacing } from "../../game/sim/conditions";
import type { Fighter } from "../../game/sim/fighter";
import { FLOOR_HEIGHT } from "../../game/presentation/arenaCamera";
import { type WorldOrigin, hideEffect } from "../../game/render/effects";
import type { FighterBody } from "./state";
import { FIGHTER_OBJECTS } from "../../game/objectData";
import { applyFighterObject } from "../../platform/objectData";
import { fitFighterPlacement } from "../../game/presentation/fighterPlacement";
import { fighterModelScale } from "../../game/presentation/fighterScale";


const CROW_FORM = 0x416d7266;

const LOCUST = 0x416c6f63;
const DIZZY_MODEL = "Abilities\\Spells\\Human\\Thunderclap\\ThunderclapTarget.mdx";


const placement = { x: 0.0, z: 0.0 };

export function colorFighterBody(body: FighterBody, slot: number, color: number): void {
  if (body.color === color) return;
  body.color = color;
  SetPlayerColor(Player(slot), ConvertPlayerColor(color));
  SetUnitColor(body.unit, ConvertPlayerColor(color));
}

export function paintFighterBody(body: FighterBody, red: number, green: number, blue: number, alpha: number, tint: CostumeTint | undefined): void {
  if (tint === undefined) SetUnitVertexColor(body.unit, red, green, blue, alpha);
  else SetUnitVertexColor(body.unit, floorDiv(red * tint[0], 255), floorDiv(green * tint[1], 255), floorDiv(blue * tint[2], 255), alpha);
}

export function placeFighterBody(body: FighterBody, fighter: Readonly<Fighter>, origin: WorldOrigin, stage = 0): void {
  fitFighterPlacement(placement, fighter, stage);
  SetUnitX(body.unit, origin.x + placement.x);
  SetUnitY(body.unit, origin.y);
  SetUnitFlyHeight(body.unit, FLOOR_HEIGHT + placement.z, 0.0);
  const scale = fighterModelScale(fighter);
  SetUnitScale(body.unit, scale, scale, scale);
  BlzSetUnitFacingEx(body.unit, fighterPoseFacing(fighter) > 0 ? 0.0 : 180.0);
}

export function createFighterBody(owner: player, fighter: Readonly<Fighter>, origin: WorldOrigin): FighterBody {
  const definition = FIGHTER_OBJECTS[fighter.character];
  const unit = CreateUnit(owner, definition.id, origin.x + fighter.motion.x, origin.y, fighter.facing > 0 ? 0.0 : 180.0);
  applyFighterObject(unit, definition);
  SetUnitInvulnerable(unit, true);
  SetUnitPathing(unit, false);
  UnitAddAbility(unit, CROW_FORM);
  UnitRemoveAbility(unit, CROW_FORM);
  UnitAddAbility(unit, LOCUST);
  PauseUnit(unit, true);
  // Online, Warcraft handles must be born on the same turn on every client, so the dizzy stars are made with the body and only shown and hidden on drawn frames.
  const dizzy = AddSpecialEffect(DIZZY_MODEL, origin.x, origin.y);
  hideEffect(dizzy, origin);
  const body: FighterBody = { unit, dizzy, dizzyShown: false, renderedSelection: 0, color: -1 };
  placeFighterBody(body, fighter, origin);
  return body;
}

function clearDizzy(body: FighterBody, origin: WorldOrigin): void {
  if (!body.dizzyShown) return;
  body.dizzyShown = false;
  hideEffect(body.dizzy, origin);
}


export function renderDizzy(body: FighterBody, fighter: Readonly<Fighter>, playing: boolean, origin: WorldOrigin): void {
  if (fighter.shield.breakState !== ShieldBreak.dizzy || fighter.status.out || !playing) {
    clearDizzy(body, origin);
    return;
  }
  const x = origin.x + fighter.motion.x;
  if (!body.dizzyShown) BlzSetSpecialEffectScale(body.dizzy, 1.0);
  body.dizzyShown = true;
  BlzSetSpecialEffectPosition(body.dizzy, x, origin.y, f32(origin.z + fighter.motion.z + 115));
}

export function removeFighterBody(body: FighterBody): void {
  DestroyEffect(body.dizzy);
  RemoveUnit(body.unit);
}
