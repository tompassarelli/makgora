import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { INTEGRITY_BUILD } from "../../src/game/session/currentBuild";
import { install, startBuild } from "../../src/platform/main";
import { shell } from "../../src/host/loop/state";
import type { Game } from "../../scripts/wisp/botMatch";
import { type HandleBaseline, SOAK_MATCHES, frameLine, handleLine, handleProblems, playHandleBaseline } from "../../scripts/wisp/handleBaseline";
import { SMASHCRAFT_HEADLESS } from "../../scripts/wisp/headless";

export interface BunBaseline extends HandleBaseline {
  readonly slots: readonly number[];
  readonly errors: readonly string[];
}

/** Plays smashcraft:ts/scripts/wisp/handleBaseline.ts's scenario for `matches` matches on the integrity build in Bun. */
export function playBunHandleBaseline(matches: number, matchFrames?: number): BunBaseline {
  const declarations = readNativeDeclarations();
  const headless = installHeadless(SMASHCRAFT_HEADLESS, declarations);
  try {
    const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 7) });
    const baseline = playHandleBaseline(clients, declarations.functions, matches, (client) => {
      let game: Game | undefined;
      client.run(() => {
        game = shell().game;
      });
      if (game === undefined) throw new Error(`p${client.slot} has no shell`);
      return game;
    }, { matchFrames });
    return { ...baseline, slots: clients.clients.map((client) => client.slot), errors: clients.clients.flatMap((client) => client.errors.map((error) => `p${client.slot + 1}: ${error}`)) };
  } finally {
    headless.restore();
  }
}

// `bun test/soak/handles.ts [MATCHES]`: the Bun half of `bun wisp soak handles`, printing the
// same lines as its Lua32 half (scripts/wisp/handleBaselineLua.ts).
if (import.meta.main) {
  const [matchesText] = process.argv.slice(2);
  const matches = Number(matchesText ?? SOAK_MATCHES);
  if (!Number.isInteger(matches) || matches < 2) throw new Error("usage: bun test/soak/handles.ts [MATCHES >= 2]");
  const run = playBunHandleBaseline(matches);
  const problems = [...handleProblems(run, run.slots), ...run.errors];
  run.slots.forEach((slot, index) => {
    const p = `p${slot + 1}`;
    console.log(`${p} before: ${handleLine(run.cold[index])}`);
    console.log(`${p} after match 1: ${handleLine(run.afterMatches[0]?.[index])}`);
    console.log(`${p} after match ${matches} (rematch ${matches - 1}): ${handleLine(run.afterMatches[matches - 1]?.[index])}`);
  });
  console.log(frameLine(run));
  for (const problem of problems) console.log(`problem ${problem}`);
  console.log(`done problems=${problems.length}`);
  if (problems.length > 0) process.exitCode = 1;
}
