import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NEUTRAL_INPUT, createStandaloneSession } from "../scripts/wisp/standalone";
import { shell } from "../src/host/loop/state";
import { Phase } from "../src/game/lobby/lobbyState";
import { MENU_MUSIC } from "../src/game/presentation/matchAudio";

const PAD = join(import.meta.dir, "native/pads/music-journey.pad");
const STEPS = 2400;
const PHASE_SCREENS = ["characters", "stages", "match", "results"] as const;

interface Stay { readonly screen: string; readonly from: number; readonly held: readonly string[]; readonly most: number }

async function journey(): Promise<readonly Stay[]> {
  const session = await createStandaloneSession({ start: "select", chosen: "demonHunter", script: readFileSync(PAD, "utf8") });
  const held = new Set<string>();
  const stays: { screen: string; from: number; held: string[]; most: number }[] = [];
  let seen = 0;
  try {
    for (let step = 1; step <= STEPS; step++) {
      session.step(NEUTRAL_INPUT);
      let screen = "";
      session.client.run(() => {
        const state = shell();
        screen = state.game.phase === Phase.characterMenu && state.pauseMenu?.title === true ? "title" : PHASE_SCREENS[state.game.phase] ?? "unknown";
      });
      const log = session.client.soundLog;
      for (const cue of log.slice(seen)) {
        if (cue.kind !== "music" || cue.source === undefined) continue;
        if (cue.event === "start") held.add(cue.source); else if (cue.event === "stop") held.delete(cue.source);
      }
      seen = log.length;
      const last = stays.at(-1);
      if (last === undefined || last.screen !== screen) stays.push({ screen, from: step, held: [...held], most: held.size });
      else last.most = Math.max(last.most, held.size);
      if (stays.at(-1)) stays.at(-1)!.held = [...held];
    }
  } finally {
    session.close();
  }
  return stays;
}

const SCREENS = ["characters", "title", "characters", "stages", "match", "results", "match", "results", "characters"];

test("the music journey plays one track on each screen, from title through rematch back to the menu [k1 scenario]", async () => {
  const stays = await journey();
  expect(stays.map(stay => stay.screen)).toEqual(SCREENS);
  for (const stay of stays) {
    expect(stay.held.length, `${stay.screen} at ${stay.from}`).toBe(1);
    expect(stay.most, `${stay.screen} at ${stay.from}`).toBe(1);
  }
  const tracks = stays.map(stay => stay.held[0]);
  for (const index of [0, 1, 2, 3, 8]) expect(tracks[index]).toBe(MENU_MUSIC);
  expect(tracks[4]).not.toBe(MENU_MUSIC);
  expect(tracks[6]).toBe(tracks[4]);
  expect(tracks[5]).not.toBe(MENU_MUSIC);
  expect(tracks[7]).toBe(tracks[5]);
}, 300_000);
