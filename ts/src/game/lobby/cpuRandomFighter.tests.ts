import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { type TapeOperation } from "../replay/tape";
import { type TapeSession, createTapeSession, performTapeOperation } from "../replay/tapeRunner";
import { canonicalState } from "../replay/canonical";
import { copyReplayState } from "../replay/snapshot";
import { cpuProfileLabel, drawCpuFighter, resolveCpuOpponent } from "../match/cpuProfiles";
import { createMatchTally, resultRows } from "../presentation/matchCues";
import { matchStartNotice } from "../session/messages";
import { resetMatchFrameInput } from "../match/frameInput";
import { PLAYABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { fighterAt } from "../sim/roster";
import {
  Phase, RANDOM_FIGHTER, ResultPick, beginRematchCountdown, confirmRematch, cpuFighterRandom, cycleSlotMode, requestStageSelect, selectCharacter,
  selectCpuCharacter, setAutomaticRematch, tickRematchCountdown,
} from "./lobbyState";

const CPU = 1;
let line = 0;

function perform(session: TapeSession, operation: TapeOperation): void {
  const refused = performTapeOperation(session, operation);
  if (refused !== undefined) throw new Error(refused);
}

function play(session: TapeSession, frames: number): void {
  for (let frame = 1; frame <= frames; frame++) perform(session, { kind: "frame", line: ++line, frame });
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
  const fighter = drawCpuFighter(PLAYABLE_CHARACTERS, match.matchSeed, CPU);
  assertEquals(match.characterChoices[CPU], fighter, "fighter drawn from the match seed");
  assertEquals(fighterAt(world, CPU).character, fighter, "spawned fighter");
  assertEquals(match.cpuResolvedOpponents[CPU], resolveCpuOpponent("random", match.matchSeed, CPU), "opponent drawn from the match seed");
  assertTrue(cpuFighterRandom(match, CPU));
  assertEquals(match.cpuOpponents[CPU], "random");
}

const reveal = (session: TapeSession): string => {
  const { match } = session.live;
  return `${fighterName(match.characterChoices[CPU])} · ${cpuProfileLabel(match.cpuResolvedOpponents[CPU], match.cpuTiers[CPU])}`;
};

const snapshot = (session: TapeSession): string => {
  copyReplayState(session.observed, session.live);
  return canonicalState(session.observed);
};

test("a new CPU slot draws its fighter and opponent from the match seed, keeps them through rollback and reveals them at the countdown and results [k2 property]", () => {
  const session = lobbyWithRandomCpu(4321);
  const game = session.live.match;
  assertTrue(cpuFighterRandom(game, CPU));
  start(session);
  assertDrawn(session);
  assertEquals(matchStartNotice(game), `CPU 2 · ${reveal(session)}`);
  const drawn = game.characterChoices[CPU];
  play(session, 30);
  const before = snapshot(session);
  perform(session, { kind: "rollback", line: ++line, first: 12, last: 30 });
  assertEquals(snapshot(session), before, "replayed state");
  assertEquals(game.characterChoices[CPU], drawn);
  assertEquals(matchStartNotice(game), `CPU 2 · ${reveal(session)}`);
  game.phase = Phase.result;
  const row = resultRows(game, session.live.world, createMatchTally()).find(entry => entry.slot === CPU);
  assertTrue(row !== undefined && row.text.startsWith(`P2 CPU · ${reveal(session)}\n`));
});

test("Random CPU fighter and opponent draw again on every New Match and automatic rematch, and a fixed pick stays fixed [k2 property]", () => {
  const session = lobbyWithRandomCpu(77);
  const game = session.live.match;
  setAutomaticRematch(game, 0, true);
  assertTrue(game.automaticRematch);
  const fighters = new Set<number>();
  const opponents = new Set<string>();
  const record = (): void => {
    fighters.add(game.characterChoices[CPU]);
    opponents.add(game.cpuResolvedOpponents[CPU]);
  };
  start(session);
  for (let match = 0; match < 6; match++) {
    assertDrawn(session);
    record();
    const seed = game.matchSeed;
    play(session, 1);
    game.phase = Phase.result;
    assertTrue(confirmRematch(game, 0, ResultPick.newStage));
    start(session);
    assertEquals(game.matchSeed, seed + 1, "New Match draws from a fresh shared seed");
  }
  for (let rematch = 0; rematch < 6; rematch++) {
    const seed = game.matchSeed;
    game.matchFrame = 60;
    game.phase = Phase.result;
    beginRematchCountdown(game, 1);
    let begun = false;
    while (!begun) begun = tickRematchCountdown(game);
    assertEquals(game.matchSeed, seed + 1, "automatic rematch draws from a fresh shared seed");
    assertEquals(game.characterChoices[CPU], drawCpuFighter(PLAYABLE_CHARACTERS, game.matchSeed, CPU));
    assertEquals(game.cpuResolvedOpponents[CPU], resolveCpuOpponent("random", game.matchSeed, CPU));
    record();
  }
  assertGreaterThan(fighters.size, 3);
  assertGreaterThan(opponents.size, 2);
  game.phase = Phase.characterMenu;
  const fixed = at(PLAYABLE_CHARACTERS, 3);
  selectCpuCharacter(game, 0, CPU, fixed);
  assertFalse(cpuFighterRandom(game, CPU));
  start(session);
  play(session, 1);
  game.phase = Phase.result;
  assertTrue(confirmRematch(game, 0, ResultPick.newStage));
  start(session);
  assertEquals(game.characterChoices[CPU], fixed);
  game.phase = Phase.characterMenu;
  selectCpuCharacter(game, 0, CPU, RANDOM_FIGHTER);
  assertTrue(cpuFighterRandom(game, CPU));
});
