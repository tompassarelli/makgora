

import { f32 } from "wisp/src/sim/f32";
import { ShieldBreak } from "../../game/sim/codes";
import { fighterPoseFacing } from "../../game/sim/conditions";
import type { Fighter } from "../../game/sim/fighter";
import { FLOOR_HEIGHT } from "../../game/presentation/arenaCamera";
import type { WorldOrigin } from "../../game/render/effects";
import type { FighterBody } from "./state";
import { FIGHTER_OBJECTS } from "../../game/objectData";
import { applyFighterObject } from "../../platform/objectData";
import { fitFighterPlacement } from "../../game/presentation/fighterPlacement";
import { characterModelScale } from "../../game/presentation/modelScale";
import { PARASOL_GRIP, PARASOL_MODEL, parasolShown } from "../../game/presentation/parasolLook";


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

export function placeFighterBody(body: FighterBody, fighter: Readonly<Fighter>, origin: WorldOrigin, stage = 0): void {
  fitFighterPlacement(placement, fighter, stage);
  SetUnitX(body.unit, origin.x + placement.x);
  SetUnitY(body.unit, origin.y);
  SetUnitFlyHeight(body.unit, FLOOR_HEIGHT + placement.z, 0.0);
  const scale = characterModelScale(fighter.character);
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
  const body: FighterBody = { unit, dizzy: undefined, parasol: undefined, renderedSelection: 0, color: -1 };
  placeFighterBody(body, fighter, origin);
  return body;
}

function clearDizzy(body: FighterBody): void {
  if (body.dizzy === undefined) return;
  BlzSetSpecialEffectScale(body.dizzy, 0.0);
  DestroyEffect(body.dizzy);
  body.dizzy = undefined;
}


export function renderDizzy(body: FighterBody, fighter: Readonly<Fighter>, playing: boolean, origin: WorldOrigin): void {
  if (fighter.shield.breakState !== ShieldBreak.dizzy || fighter.status.out || !playing) {
    clearDizzy(body);
    return;
  }
  const x = origin.x + fighter.motion.x;
  body.dizzy ??= AddSpecialEffect(DIZZY_MODEL, x, origin.y);
  BlzSetSpecialEffectPosition(body.dizzy, x, origin.y, f32(origin.z + fighter.motion.z + 115));
}

export function renderParasol(body: FighterBody, fighter: Readonly<Fighter>, playing: boolean, origin: WorldOrigin, stage: number): void {
  if (parasolShown(fighter) && playing) {
    fitFighterPlacement(placement, fighter, stage);
    const scale = characterModelScale(fighter.character);
    const x = f32(origin.x + placement.x + f32(fighterPoseFacing(fighter) * f32(PARASOL_GRIP.x * scale)));
    body.parasol ??= AddSpecialEffect(PARASOL_MODEL, x, origin.y);
    BlzSetSpecialEffectScale(body.parasol, scale);
    BlzSetSpecialEffectPosition(body.parasol, x, origin.y, f32(origin.z + placement.z + f32(PARASOL_GRIP.z * scale)));
    return;
  }
  if (body.parasol === undefined) return;
  DestroyEffect(body.parasol);
  body.parasol = undefined;
}

export function removeFighterBody(body: FighterBody): void {
  clearDizzy(body);
  if (body.parasol !== undefined) DestroyEffect(body.parasol);
  body.parasol = undefined;
  RemoveUnit(body.unit);
}
