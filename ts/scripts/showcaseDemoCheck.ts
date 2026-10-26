import { join } from "node:path";
import type { MapEntry } from "wisp/src/headless/client";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { CAPTURE_STATUS_FILE } from "../src/game/core/gameFiles";
import { STAMP_CELLS, type StampCell, readStamp } from "../src/game/core/drawnStamp";
import { showcaseRows } from "../src/game/session/showcaseTimeline";
import { fighterKey, selectableCharacterBySlug } from "../src/game/roster/kits";
import { SHOWCASE_HOLD_TICKS } from "../src/platform/captureFixtures";
import type { Character } from "../src/game/sim/codes";
import { SMASHCRAFT_HEADLESS } from "./wisp/headless";

const TEXTURE_CELLS: Readonly<Record<string, StampCell>> = {
  "ReplaceableTextures\\TeamColor\\TeamColor06.blp": "guard",
  "ReplaceableTextures\\TeamColor\\TeamColor00.blp": "one",
  "ReplaceableTextures\\TeamColor\\TeamColor01.blp": "zero",
};
const STALL_TICKS = 3_000;

function characterOf(slug: string): Character {
  const character = selectableCharacterBySlug(slug);
  if (character === undefined) throw new Error(`unknown fighter ${slug}`);
  return character;
}

export interface Held { readonly status: string; readonly script: number; readonly frame: number }

export function expectedHolds(slug: string): string[] {
  const character = characterOf(slug);
  return showcaseRows(character).flatMap(({ row, frames }, index) => frames.map(frame => `CAPTURE SCRIPT ${index + 1} ${slug}-${row} @${frame}`));
}

export async function playDemo(slug: string): Promise<{ readonly holds: Held[]; readonly ticks: number; readonly done: string }> {
  const character = characterOf(slug);
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const { nativeDriverCommand }: { nativeDriverCommand(text: string): void } = await import(join(import.meta.dir, "../src/platform/nativeDriver.ts"));
    const entry: MapEntry = await import(join(import.meta.dir, "../src/host/entries/showcaseMain.ts"));
    const clients = runtime.clients(entry, [0]);
    const client = clients.client(0);
    clients.start();
    clients.frames(3);
    clients.everywhere(() => nativeDriverCommand(`dev -dev showcase demo ${fighterKey(character).toLowerCase()}`));
    const status = () => client.files.get(CAPTURE_STATUS_FILE)?.[0] ?? "";
    const stamp = () => {
      const cells: (StampCell | "unclear")[] = [];
      for (let index = 0; index < STAMP_CELLS; index++) cells.push(TEXTURE_CELLS[client.frames.named("SmashcraftDrawnStamp", index)?.texture ?? ""] ?? "unclear");
      return readStamp(cells);
    };
    const runs: { held: Held; ticks: number }[] = [];
    let ticks = 0;
    let changed = 0;
    while (!status().startsWith("CAPTURE DONE")) {
      const previous = runs.at(-1)?.held;
      if (++ticks - changed > STALL_TICKS) throw new Error(`${slug}: the demo stalled ${STALL_TICKS} ticks at "${status()}", stamp ${previous?.script}/${previous?.frame}; ${[...client.errors, ...client.thrown].join("; ")}`);
      clients.frames(1);
      const shown = stamp();
      if (shown === undefined) continue;
      const held = { status: status(), script: shown.script, frame: shown.frame };
      const last = runs.at(-1);
      if (last !== undefined && last.held.status === held.status && last.held.script === held.script && last.held.frame === held.frame) last.ticks++;
      else {
        runs.push({ held, ticks: 1 });
        changed = ticks;
      }
    }
    if (client.errors.length > 0) throw new Error(`${slug}: ${client.errors.join("; ")}`);
    return { holds: runs.filter(run => run.ticks >= SHOWCASE_HOLD_TICKS).map(run => run.held), ticks, done: status() };
  } finally {
    runtime.restore();
  }
}

export async function checkDemo(slug: string): Promise<string[]> {
  const { holds, ticks, done } = await playDemo(slug);
  const expected = expectedHolds(slug);
  const firstScript = holds[0]?.script ?? 0;
  const seen = holds.map(held => `${held.status} @${held.frame}`);
  const problems: string[] = [];
  holds.forEach((held, index) => {
    const row = Number(held.status.split(" ")[2]);
    if (held.script !== (firstScript + row - 1) % 64) problems.push(`hold ${index + 1}: stamp script ${held.script} is not row ${row}'s`);
  });
  const length = Math.max(seen.length, expected.length);
  for (let index = 0; index < length; index++) if (seen[index] !== expected[index]) problems.push(`hold ${index + 1}: saw "${seen[index] ?? "nothing"}", timeline says "${expected[index] ?? "nothing"}"`);
  if (done !== `CAPTURE DONE ${showcaseRows(characterOf(slug)).length}`) problems.push(`final status "${done}"`);
  console.log(`${slug}: ${seen.length} held stamps over ${ticks} ticks, timeline ${expected.length}; ${problems.length === 0 ? "match" : `${problems.length} mismatches`}`);
  return problems;
}

if (import.meta.main) {
  const slugs = Bun.argv.slice(2);
  if (slugs.length === 0) throw new Error("usage: showcaseDemoCheck.ts FIGHTER_SLUG...");
  let failed = false;
  for (const slug of slugs) {
    const problems = await checkDemo(slug);
    for (const problem of problems.slice(0, 20)) console.log(`  ${problem}`);
    failed ||= problems.length > 0;
  }
  process.exit(failed ? 1 : 0);
}
