import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NEUTRAL_INPUT, createStandaloneSession } from "../scripts/wisp/standalone";
import { Phase } from "../src/game/lobby/lobbyState";
import { shell } from "../src/host/loop/state";

const PAD = join(import.meta.dir, "native/pads/arcade-warchief-stage2.pad");

interface Seen { readonly phase: number; readonly fight: number; readonly tier: number; readonly title: string; readonly opponent: string }

test("a pad picks Arcade, Warchief and Illidan on character select, wins stage 1 and starts stage 2's match with each stage's title on screen [k1 scenario]", async () => {
  const session = await createStandaloneSession({ start: "select", script: readFileSync(PAD, "utf8") });
  const stays: Seen[] = [];
  try {
    for (let step = 1; step <= 3400; step++) {
      session.step(NEUTRAL_INPUT);
      session.client.run(() => {
        const s = shell();
        const { game } = s;
        const seen: Seen = { phase: game.phase, fight: game.run.fight, tier: game.run.tier, title: s.status.text, opponent: game.run.current?.opponents[0]?.opponent ?? "" };
        const last = stays.at(-1);
        if (last === undefined || last.phase !== seen.phase || last.fight !== seen.fight || (seen.phase === Phase.match && last.title !== seen.title)) stays.push(seen);
      });
    }
  } finally {
    session.close();
  }
  const matches = stays.filter(stay => stay.phase === Phase.match);
  expect(matches.map(stay => stay.fight)).toEqual([0, 1]);
  expect(matches.every(stay => stay.tier === 2 && stay.opponent === "wren")).toBe(true);
  expect(matches[0]?.title).toContain("Stage 1 of 8 · Hallway");
  expect(matches[1]?.title).toContain("Stage 2 of 8 · Hallway");
}, 300_000);
