import { f32 } from "wisp/src/sim/f32";
import { isParticipantSlot } from "../input/participants";
import { type MatchState, Phase } from "../lobby/lobbyState";
import { parseDecimal } from "../netcode/journal/decimal";
import { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { mutableCandle } from "../sim/fighterRest";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { CANDLE_LEVEL_HEAT, CANDLE_MAX_LEVEL, dropCandle, resetCandle } from "../fighters/kobold/candle";

interface SetupTarget {
  readonly player: number;
  readonly slot: number;
  readonly valueText: string;
  readonly value: number | undefined;
}

function setupTarget(text: string): SetupTarget | undefined {
  const [playerText, valueText, extra] = text.split(" ");
  const player = parseDecimal(playerText ?? "");
  const slot = player === undefined ? -1 : player - 1;
  if (extra !== undefined || valueText === undefined || player === undefined || `${player}` !== playerText || !isParticipantSlot(slot)) return undefined;
  return { player, slot, valueText, value: parseDecimal(valueText) };
}

function applyCandleSetup(fighter: Fighter, target: SetupTarget, prepare: () => void): boolean {
  const { value, valueText } = target;
  if (fighter.character !== Character.kobold) return false;
  if (valueText !== "drop" && (value === undefined || `${value}` !== valueText || value < 0 || value > CANDLE_MAX_LEVEL)) return false;
  prepare();
  if (valueText === "drop") dropCandle(fighter);
  else {
    resetCandle(fighter);
    mutableCandle(fighter).heat = value === 0 ? 0 : ((value ?? 0) + 1) * CANDLE_LEVEL_HEAT - 1;
  }
  return true;
}

const SETUP_KINDS = ["percent", "lives", "candle"] as const;

export function applyFighterSetup(game: MatchState, world: Roster, message: string, prepare: () => void): string | undefined {
  const what = SETUP_KINDS.find(kind => message.startsWith(`-dev ${kind} `));
  if (what === undefined) return undefined;
  const refused = `dev: ${what} refused`;
  const target = setupTarget(message.substring(what.length + 6));
  if (target === undefined || game.phase !== Phase.match || !isActive(world, target.slot)) return refused;
  const fighter = fighterAt(world, target.slot);
  if (fighter.status.out) return refused;
  const { value } = target;
  if (what === "percent") {
    if (value === undefined || value < 0 || value > 999) return refused;
    prepare();
    fighter.status.damage = f32(value);
  } else if (what === "lives") {
    if (value === undefined || value < 1 || value > 99) return refused;
    prepare();
    fighter.status.stocks = value;
  } else if (!applyCandleSetup(fighter, target, prepare)) return refused;
  return `dev: player ${target.player} ${what} ${target.valueText}`;
}
