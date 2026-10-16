import { expect, test } from "bun:test";
import { playedMoves } from "../../tools/animations/hd-models";
import { flashableSequences } from "../../tools/animations/white-flash-keys";
import { originalClip, originalClipCount, originalClipNamed, originalClipNames } from "../src/generated/clips/fighterOriginalClipInfo";
import { victoryAnimation } from "../src/game/presentation/matchAudio";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { LEVEL_UP_FRAME, MatchPresentation } from "../src/game/render/matchPresentation";
import { Phase, createMatchState } from "../src/game/lobby/lobbyState";
import { createMatchTally, resultsView } from "../src/game/presentation/matchCues";
import { Character } from "../src/game/sim/codes";
import { createRoster } from "../src/game/sim/roster";
import { createFighter } from "../src/game/sim/fighter";
import { soloWorld } from "../src/game/sim/testWorld";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("every fighter's Classic body carries its results-screen victory pose and no other sequence the game never plays [k2 property]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const names = Array.from({ length: originalClipCount(character) }, () => "");
    for (const [name, index] of originalClipNames(character)) if (names[index] === "") names[index] = name;
    const motion = { Sequences: names.map(Name => ({ Name })) } as unknown as Parameters<typeof playedMoves>[1];
    const victory = originalClipNamed(character, victoryAnimation(character));
    expect(victory, `${fighterName(character)} has no victory clip`).toBeDefined();
    const flashable = new Set(flashableSequences(character, motion.Sequences).map((sequence) => motion.Sequences.indexOf(sequence)));
    expect(playedMoves(character, motion).classic.filter((index) => !flashable.has(index)), fighterName(character)).toEqual(flashable.has(victory as number) ? [] : [victory as number]);
  }
});

test("results playback shows full stock victories and casts once before holding ready [k5 boundary results-animation]", () => {
  const client = headless.clients({ start: () => {}, install: () => {} }, [0]).client(0);
  client.run(() => {
    const presentation = new MatchPresentation({ x: 0, y: 0, z: 0 }, { show: () => undefined, hide: () => undefined });
    for (const character of SELECTABLE_CHARACTERS) {
      const name = fighterName(character);
      const clipIndex = originalClipNamed(character, victoryAnimation(character));
      const clip = clipIndex === undefined ? undefined : originalClip(character, clipIndex);
      if (clip === undefined) throw new Error(`${name}: missing victory`);
      const duration = clip.endSeconds - clip.startSeconds;
      presentation.preparePoses(soloWorld(createFighter(character, 0, 1)));
      const bursts = () => client.effectPoses().filter(pose => pose.model.includes("LevelupCaster")).length;
      const burstsBefore = bursts();
      presentation.beginResults({ rows: [{ slot: 0, winner: true, text: name }], winner: character, winnerSlot: 0, x: 0, z: 0 }, 0);
      const drawn = () => client.effectPoses({ visibleOnly: true }).find(pose => pose.destroyed === undefined && pose.model === clip.modelPath);
      expect(drawn()?.animationElapsed, `${name}: clip begins at its first frame`).toBeCloseTo(clip.timeline === true ? clip.startSeconds : 0, 4);
      let previous = drawn()?.animationElapsed ?? 0;
      let held: number | undefined;
      for (let frame = 1; frame <= 360; frame++) {
        presentation.tick();
        const pose = drawn();
        expect(pose, `${name}/${frame}: visible body`).toBeDefined();
        if (pose === undefined) throw new Error(`${name}: missing body`);
        expect(pose.timeScale).toBe(0);
        const elapsed = frame / 60;
        expect(bursts() - burstsBefore, `${name}/${frame}: the level-up burst plays early in the victory`).toBe(frame < LEVEL_UP_FRAME ? 0 : 1);
        if (victoryAnimation(character).includes("victory")) {
          expect(pose.animationElapsed).toBeGreaterThanOrEqual(clip.startSeconds);
          expect(pose.animationElapsed).toBeLessThanOrEqual(clip.endSeconds);
          if (elapsed < duration) expect(pose.animationElapsed).toBeGreaterThan(previous);
        } else if (elapsed < duration) {
          expect(pose.animationElapsed, `${name}: cast cannot restart`).toBeGreaterThan(previous);
          expect(pose.animationElapsed).toBeLessThanOrEqual(clip.endSeconds);
        } else if (held === undefined) {
          held = pose.animationElapsed;
          const readyIndex = originalClipNamed(character, "stand ready") ?? originalClipNamed(character, "stand");
          const ready = readyIndex === undefined ? undefined : originalClip(character, readyIndex);
          expect(ready, `${name}: ready/stand exists`).toBeDefined();
          expect(held, `${name}: finishes in the first ready/stand pose`).toBeCloseTo(ready?.timeline === true ? ready.startSeconds : 0, 4);
        } else expect(pose.animationElapsed, `${name}: final ready/stand pose stays held`).toBe(held);
        previous = pose.animationElapsed;
      }
      presentation.hideResults();
      expect(drawn(), `${name}: rematch removes result body`).toBeUndefined();
    }
    const game = createMatchState();
    game.phase = Phase.result; game.teamBattle = true; game.winner = 0;
    game.humanFighterMask = 7; game.computerMask = 0;
    game.teamChoices[0] = 0; game.teamChoices[1] = 0; game.teamChoices[2] = 1;
    const world = createRoster(7, [createFighter(Character.blademaster, 0, 1), createFighter(Character.dreadlord, 0, 1), createFighter(Character.rifleman, 0, 1)]);
    presentation.preparePoses(world);
    const results = resultsView(game, world, createMatchTally());
    expect(results.rows.filter(row => row.winner).map(row => row.slot).sort()).toEqual([0, 1]);
    presentation.beginResults(results, 0);
    for (const character of [Character.blademaster, Character.dreadlord]) {
      const index = originalClipNamed(character, victoryAnimation(character));
      const clip = index === undefined ? undefined : originalClip(character, index);
      if (clip === undefined) throw new Error("missing team victory clip");
      const pose = client.effectPoses({ visibleOnly: true }).find(pose => pose.destroyed === undefined && pose.model === clip.modelPath);
      expect(pose?.animationElapsed, `${fighterName(character)} team win uses victory`).toBeCloseTo(clip.timeline === true ? clip.startSeconds : 0, 4);
    }
    presentation.hideResults();
  });
  expect(client.errors).toEqual([]);
});
