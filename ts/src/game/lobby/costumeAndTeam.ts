import { costumesFor } from "../roster/costumes";
import { costumeSystem } from "../roster/costumeSwitch";
import { floorMod } from "wisp/src/sim/intMath";
import { isParticipantSlot } from "../input/participants";
import { canChooseComputer, costumeFor, fighterActive, humanFighterActive, humanPresent, type MatchState, Phase } from "./lobbyState";
import { cpuFighterRandom } from "./characterChoice";

export function cycleCostume(game: MatchState, actor: number, slot: number, direction: number): void {
  if (!costumeSystem.enabled || game.phase !== Phase.characterMenu || !isParticipantSlot(slot) || !fighterActive(game, slot) || cpuFighterRandom(game, slot)
    || !humanPresent(game, actor) || !(actor === slot && humanFighterActive(game, slot) || canChooseComputer(game, actor, slot))) return;
  const count = costumesFor(game.characterChoices[slot]).length;
  game.costumeChoices[slot] = floorMod(costumeFor(game, slot) + direction, count);
}

export function cycleTeam(game: MatchState, actor: number, slot: number, direction: number): void {
  if (game.phase !== Phase.characterMenu || !game.teamBattle || !isParticipantSlot(slot) || !fighterActive(game, slot)
    || !humanPresent(game, actor) || !(actor === slot && humanFighterActive(game, slot) || canChooseComputer(game, actor, slot))) return;
  const team = floorMod(game.teamChoices[slot] + direction, 4);
  if (team === 0 || team === 1 || team === 2 || team === 3) game.teamChoices[slot] = team;
}
