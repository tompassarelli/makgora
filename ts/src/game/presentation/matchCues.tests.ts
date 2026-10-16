import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { IMPORTED_MUSIC } from "../assets/importedMusicInfo";
import { VERIFIED_STOCK_SOUNDS } from "../../generated/assets/stockSoundInfo";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { executeNext, testMatch } from "../match/testMatch";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../replay/snapshot";
import { Phase } from "../lobby/lobbyState";
import { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import type { Fighter } from "../sim/fighter";
import { fighterAt } from "../sim/roster";
import { MENU_MUSIC, MatchCue, cueSound, presentationSoundPaths, readyVoice, stageMusic, victoryMusic, warcryVoice } from "./matchAudio";
import {
  type CueObservation, type MatchTally, confirmedFrameCues, createCueObservation, createMatchTally, createMenuCues, createMenuObservation,
  menuFrameCues, observeForCues, resultsView,
} from "./matchCues";
import type { TestMatch } from "../match/testMatch";

const verified = (path: string): boolean => VERIFIED_STOCK_SOUNDS[path] !== undefined || IMPORTED_MUSIC.some(music => music.path === path);

test("every match sound, theme and voice line is verified stock or approved imported media [k4 reference native]", () => {
  const stages = STAGE_CATALOG.map(stage => stage.id);
  for (const path of presentationSoundPaths(SELECTABLE_CHARACTERS, stages)) assertEquals(verified(path), true, path);
  for (const stage of stages) assertEquals(verified(stageMusic(stage)), true, `stage ${stage}`);
  assertTrue(verified(MENU_MUSIC));
  for (const character of SELECTABLE_CHARACTERS) {
    assertEquals(verified(readyVoice(character)), true, `ready ${character}`);
    assertEquals(verified(warcryVoice(character)), true, `warcry ${character}`);
    const theme = victoryMusic(character);
    assertEquals(theme !== undefined && verified(theme), true, `victory ${character}`);
  }
  for (let cue = 0; cue <= MatchCue.cheer; cue++) assertEquals(verified(cueSound(cue as MatchCue)), true, `cue ${cue}`);
  assertEquals(victoryMusic(undefined), undefined);
});

test("every selectable stage plays its own stock Warcraft track [k3 measure docs/design/stage-music.md]", () => {
  const tracks: string[] = [];
  for (const stage of STAGE_CATALOG) {
    const track = stageMusic(stage.id) as string | undefined;
    assertEquals(track !== undefined && verified(track), true, `${stage.name} (${stage.id}) has no stock track`);
    assertEquals(tracks.includes(track!), false, `${stage.name} (${stage.id}) shares ${track}`);
    tracks.push(track!);
  }
});


function presentFrame(match: TestMatch, observation: CueObservation, tally: MatchTally, cues: MatchCue[], serials: number[] = [], simulated?: (candle: Fighter["candle"]) => void): void {
  observeForCues(observation, match.game, match.world);
  executeNext(match);
  simulated?.(fighterAt(match.world, 0).candle);
  confirmedFrameCues(observation, match.game, match.world, tally, cues, serials);
}


function knockOut(match: TestMatch, slot: number, attacker: number): void {
  const fighter = fighterAt(match.world, slot);
  fighter.hits.lastAttacker = attacker;
  fighter.motion.x = -100000.0;
}

test("knockouts, the last stock and GAME! each cue once, on their confirmed frame, and the results tally them [k1 scenario]", () => {
  const match = testMatch(3, Character.rifleman);
  match.game.stockCount = 2;
  for (const slot of [0, 1]) fighterAt(match.world, slot).status.stocks = 2;
  const observation = createCueObservation();
  const tally = createMatchTally();
  const cues: MatchCue[] = [];
  presentFrame(match, observation, tally, cues);
  assertEquals(cues.length, 0);
  knockOut(match, 1, 0);
  presentFrame(match, observation, tally, cues);
  assertEquals(cues.join(","), `${MatchCue.stockLost},${MatchCue.lastStock}`);
  presentFrame(match, observation, tally, cues);
  assertEquals(cues.length, 0, "a knockout cues once");
  for (let frame = 0; frame < 120 && fighterAt(match.world, 1).status.out; frame++) presentFrame(match, observation, tally, cues);
  assertFalse(fighterAt(match.world, 1).status.out);
  knockOut(match, 1, 0);
  presentFrame(match, observation, tally, cues);
  assertEquals(match.game.phase, Phase.result);
  assertEquals(cues.join(","), `${MatchCue.stockLost},${MatchCue.game}`);
  assertEquals(tally.kos.join(","), "2,0,0,0");
  assertEquals(tally.falls.join(","), "0,2,0,0");
  const view = resultsView(match.game, match.world, tally);
  assertEquals(view.winner, Character.rifleman);
  assertEquals(view.rows.length, 2);
  assertTrue(view.rows[0]?.winner === true && view.rows[0]?.slot === 0);
});

test("a Kobold's candle drop, snuff and return each cue once on their confirmed frame, and a rolled-back drop never plays [k1 scenario]", () => {
  const match = testMatch(3, Character.kobold);
  const observation = createCueObservation();
  const tally = createMatchTally();
  const cues: MatchCue[] = [];
  const serials: number[] = [];
  presentFrame(match, observation, tally, cues, serials);
  const confirmed = createReplaySnapshot();
  captureReplaySnapshot(confirmed, match.world, match.game, match.inputs, match.runtime);
  executeNext(match);
  fighterAt(match.world, 0).candle.dropSerial++;
  executeNext(match);
  restoreReplaySnapshot(confirmed, match.world, match.game, match.inputs, match.runtime);
  presentFrame(match, observation, tally, cues, serials);
  assertEquals(cues.length, 0, "the rolled-back drop is not confirmed");
  presentFrame(match, observation, tally, cues, serials, candle => candle.dropSerial++);
  assertEquals(cues.join(","), `${MatchCue.candleDrop}`);
  assertEquals(cueSound(MatchCue.candleDrop, serials[0]), cueSound(MatchCue.candleDrop, fighterAt(match.world, 0).candle.dropSerial));
  presentFrame(match, observation, tally, cues, serials);
  assertEquals(cues.length, 0, "a drop cues once");
  presentFrame(match, observation, tally, cues, serials, candle => candle.snuffSerial++);
  assertEquals(cues.join(","), `${MatchCue.candleSnuff}`);
  presentFrame(match, observation, tally, cues, serials, candle => {
    candle.heat = 90;
    candle.returnSerial++;
  });
  assertEquals(cues.join(","), `${MatchCue.candleReturn}`, "a pickup keeps its flame and does not relight");
  presentFrame(match, observation, tally, cues, serials, candle => {
    candle.heat = 0;
    candle.returnSerial++;
  });
  assertEquals(cues.join(","), `${MatchCue.candleReturn},${MatchCue.candleRelight}`);
  presentFrame(match, observation, tally, cues, serials);
  assertEquals(cues.length, 0, "a return cues once");
  assertFalse(cueSound(MatchCue.candleDrop, 1) === cueSound(MatchCue.candleDrop, 2));
});
