import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { type TapeOperation } from "../replay/tape";
import { type TapeSession, createTapeSession, performTapeOperation } from "../replay/tapeRunner";
import { canonicalState } from "../replay/canonical";
import { copyReplayState } from "../replay/snapshot";
import { drawCpuFighter, resolveCpuOpponent } from "../match/cpuProfiles";
import { resetMatchFrameInput } from "../match/frameInput";
import { PLAYABLE_CHARACTERS } from "../roster/kits";
import { fighterAt } from "../sim/roster";
import { shownFighters } from "../roster/forge";
import { type PlayerFileQueue, lobbyCounter, receiveLobbyCounter } from "../../host/loop/playerFileQueue";
import { Phase, cycleSlotMode } from "./lobbyState";
import { cpuFighterRandom, selectCharacter, startComputerChoices } from "./characterChoice";
import { requestStageSelect } from "./stageSelect";

const CPU = 1;
let line = 0;

function perform(session: TapeSession, operation: TapeOperation): void {
  const refused = performTapeOperation(session, operation);
  if (refused !== undefined) throw new Error(refused);
}

function start(session: TapeSession): void {
  const game = session.live.match;
  if (game.phase === Phase.characterMenu) assertTrue(requestStageSelect(game, 0));
  perform(session, { kind: "start", line: ++line, slot: 0 });
  resetMatchFrameInput(session.row);
  assertEquals(game.phase, Phase.match);
}

function lobbyWithRandomCpu(seed: number): TapeSession {
  const session = createTapeSession();
  const game = session.live.match;
  game.matchSeed = seed;
  selectCharacter(game, 0, at(PLAYABLE_CHARACTERS, 0));
  assertTrue(cycleSlotMode(game, 0, CPU));
  assertTrue(cycleSlotMode(game, 0, CPU));
  return session;
}

function assertDrawn(session: TapeSession): void {
  const { match, world } = session.live;
  const fighter = drawCpuFighter(shownFighters(PLAYABLE_CHARACTERS), match.matchSeed, CPU);
  assertEquals(match.characterChoices[CPU], fighter, "fighter drawn from the match seed");
  assertEquals(fighterAt(world, CPU).character, fighter, "spawned fighter");
  assertEquals(match.cpuResolvedOpponents[CPU], resolveCpuOpponent("random", match.matchSeed, CPU), "opponent drawn from the match seed");
  assertTrue(cpuFighterRandom(match, CPU));
  assertEquals(match.cpuOpponents[CPU], "random");
}

const snapshot = (session: TapeSession): string => {
  copyReplayState(session.observed, session.live);
  return canonicalState(session.observed);
};

function lobbyStartup(sentCounter: number): TapeSession {
  const session = lobbyWithRandomCpu(0);
  const files: PlayerFileQueue = { queue: [] };
  receiveLobbyCounter(files, 0, sentCounter);
  startComputerChoices(session.live.match, lobbyCounter(files, 0) ?? 0, 0);
  return session;
}

test("Two lobbies whose first human sends different lobby counters at the same menu frame start and draw the CPU differently, and both clients of one lobby agree [k2 property]", () => {
  const first = lobbyStartup(1);
  const second = lobbyStartup(2);
  const peer = lobbyStartup(1);
  assertFalse(first.live.match.characterChoices[CPU] === second.live.match.characterChoices[CPU]);
  assertEquals(snapshot(peer), snapshot(first), "clients of one lobby");
  start(first);
  start(second);
  start(peer);
  assertDrawn(first);
  assertFalse(first.live.match.characterChoices[CPU] === second.live.match.characterChoices[CPU]);
  assertEquals(snapshot(peer), snapshot(first), "clients of one lobby in the match");
});
