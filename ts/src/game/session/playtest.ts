






import { parseDecimal } from "../netcode/journal/decimal";
import { PARTICIPANT_SLOTS, isParticipantMask, participantActive } from "../input/participants";
import {
  type MatchState, Phase, createMatchState, firstHumanSlot, humanFighterActive, humanPresent, requestStageSelect, requestStart, selectCharacter,
  selectStage, setCpuOpponent, setCpuTier, setEndless, setParticipants,
} from "../lobby/lobbyState";
import { isCpuOpponentChoice, isCpuTier, type CpuOpponentChoice, type CpuTier } from "../match/cpuProfiles";

const PREFIX = "PLAY v=4 computers=";
const OPPONENT = " opponent=";
const TIER = " difficulty=";
const ENDLESS = " endless=";

export interface PlaytestRequest {

  readonly computers: number;
  readonly opponent: CpuOpponentChoice;
  readonly tier: CpuTier;
  readonly endless: boolean;
}


export const playtestRequest = (computers: number, opponent: CpuOpponentChoice, tier: CpuTier, endless: boolean): string =>
  `${PREFIX}${computers}${OPPONENT}${opponent}${TIER}${tier}${ENDLESS}${endless ? 1 : 0}`;


export function parsePlaytestRequest(line: string): PlaytestRequest | undefined {
  if (!line.startsWith(PREFIX)) return undefined;
  const rest = line.substring(PREFIX.length);
  const split = rest.indexOf(OPPONENT);
  const tierSplit = rest.indexOf(TIER);
  const endlessSplit = rest.indexOf(ENDLESS);
  if (split < 0 || tierSplit <= split || endlessSplit <= tierSplit) return undefined;
  const computersText = rest.substring(0, split);
  const opponent = rest.substring(split + OPPONENT.length, tierSplit);
  const tier = rest.substring(tierSplit + TIER.length, endlessSplit);
  const endlessText = rest.substring(endlessSplit + ENDLESS.length);
  if (endlessText !== "0" && endlessText !== "1") return undefined;
  const computers = parseDecimal(computersText);
  if (computers === undefined || `${computers}` !== computersText || !isParticipantMask(computers)) return undefined;
  return isCpuOpponentChoice(opponent) && isCpuTier(tier) ? { computers, opponent, tier, endless: endlessText === "1" } : undefined;
}






export function preparePlaytest(game: MatchState, { computers, opponent, tier, endless }: PlaytestRequest): boolean {
  const first = firstHumanSlot(game);
  if (first === undefined || game.phase !== Phase.characterMenu || !isParticipantMask(computers) || !isCpuOpponentChoice(opponent) || !isCpuTier(tier)) return false;
  let humans = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    const computer = participantActive(computers, slot);
    if (computer && humanPresent(game, slot)) return false;

    if (!computer && humanFighterActive(game, slot) && humanPresent(game, slot)) humans += 1 << slot;
  }
  if (!isParticipantMask(humans)) return false;
  setParticipants(game, humans, computers);
  setEndless(game, first, endless);
  for (const slot of PARTICIPANT_SLOTS) if (participantActive(computers, slot)) {
    setCpuOpponent(game, first, slot, opponent);
    setCpuTier(game, first, slot, tier);
  }
  const defaults = createMatchState();
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanFighterActive(game, slot) && humanPresent(game, slot)) selectCharacter(game, slot, defaults.characterChoices[slot]);
  }
  if (!requestStageSelect(game, first)) return false;
  selectStage(game, first, defaults.stageChoice);

  return true;
}
