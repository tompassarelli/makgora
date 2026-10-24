import { f32 } from "wisp/src/sim/f32";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState, setParticipants, type MatchState } from "../src/game/lobby/lobbyState";
import { produceComputerInput } from "../src/game/match/botPlay";
import { createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { initializeMatchFighters, matchSpawnX } from "../src/game/match/step";
import { createFighter } from "../src/game/sim/fighter";
import { selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { copyControls, createRoster, neutralControls, type Roster } from "../src/game/sim/roster";

export interface ComputerMatch {
  readonly fighters: readonly string[];
  readonly stage: number;
  readonly shift: number;
  readonly stocks: number;
  readonly minutes: number;
  readonly frameLimit: number;
  readonly seed?: number;
}

const NEUTRAL = neutralControls();

export function playComputerMatch(scenario: ComputerMatch, onFrame: (match: Readonly<MatchState>, world: Readonly<Roster>) => void): void {
  const characters = scenario.fighters.map((slug) => {
    const character = selectableCharacterBySlug(slug);
    if (character === undefined) throw new Error(`unknown fighter ${slug}`);
    return character;
  });
  const mask = (1 << characters.length) - 1;
  const match = createMatchState();
  setParticipants(match, 0, mask);
  characters.forEach((character, slot) => { match.characterChoices[slot] = character; });
  match.stageChoice = scenario.stage;
  match.stockCount = scenario.stocks;
  match.timeLimitMinutes = scenario.minutes;
  match.remainingFrames = scenario.minutes * 60 * MATCH_TICKS_PER_SECOND;
  if (scenario.seed !== undefined) match.matchSeed = scenario.seed;
  match.phase = Phase.match;
  const world = createRoster(mask, characters.map((character, slot) => createFighter(character, f32(matchSpawnX(slot) + scenario.shift), matchSpawnX(slot) < 0.0 ? 1 : -1)));
  const controls = createFrameControls();
  const produced = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  initializeMatchFighters(match, world);
  let frame = 0;
  while (match.phase === Phase.match && frame < scenario.frameLimit) {
    frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      if (slot < characters.length) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
    }
    if (!captureFrame(row, frame, world.mask, produced, runtime)) throw new Error(`capture refused frame ${frame}`);
    if (!executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error(`execution refused frame ${frame}`);
    onFrame(match, world);
  }
}
