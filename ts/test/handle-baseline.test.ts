import { expect, test } from "bun:test";
import { BASELINE_LINEUP, type Look, handleProblems } from "../scripts/wisp/handleBaseline";
import { playBunHandleBaseline } from "./soak/handles";

// The census counts every handle a client creates (effect, unit, timer, sound, trigger, frame, ...) at its
// Create/Add native and uncounts it at its Destroy/Remove/KillSoundWhenDone native (scripts/wisp/memoryCensus.ts).
// The first match creates a few handles the menu keeps from then on: the stage-loading cover's frames and one
// fighter body (unit) per fighter of the last match, so fighter selection after the first match is the baseline.
// `bun wisp soak handles` plays the same scenario over 20 rematches in both looks in Bun and Lua32 (#409).
const MATCH_AND_REMATCH_FRAME_BOUND = 7_000;

// The match and rematch are deterministic: the bound is on frames stepped, and the wall timeout below only catches a hang.
function matchAndRematch(look: Look): void {
  const run = playBunHandleBaseline(look, 2);
  const [first = [], rematch = []] = run.afterMatches;
  console.log(`p1 ${look} live handles at fighter selection: before ${JSON.stringify(run.cold[0])}, after the match ${JSON.stringify(first[0])}, after the rematch ${JSON.stringify(rematch[0])}`);

  console.log(`${look} frames stepped: ${run.frames} of at most ${MATCH_AND_REMATCH_FRAME_BOUND}`);
  expect(run.frames).toBeLessThanOrEqual(MATCH_AND_REMATCH_FRAME_BOUND);
  for (const slot of run.slots) expect(run.reads[slot] ?? 0).toBeGreaterThan(0);
  for (const counts of first) expect(Object.fromEntries(counts).unit).toBe(BASELINE_LINEUP.length);
  expect(rematch).toEqual(first);
  expect(handleProblems(run, run.slots)).toEqual([]);
  expect(run.errors).toEqual([]);
}

test("a four-computer match and its rematch in the Classic look leave every client's live handles of each kind at fighter selection where the first match left them, with one fighter body per fighter [k1 scenario]", () => {
  matchAndRematch("classic");
}, 300_000);

test("a four-computer match and its rematch in the Definitive look leave every client's live handles of each kind at fighter selection where the first match left them, with one fighter body per fighter [k1 scenario]", () => {
  matchAndRematch("definitive");
}, 300_000);
