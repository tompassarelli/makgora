import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { Character } from "../../../src/game/sim/codes";
import { PLAYABLE_CHARACTERS } from "../../../src/game/roster/kits";
import { smokePairs } from "../smokeShards";
import { mergeVerdicts, smokeLines, smokeReceipt } from "../smokeJudge";
import { nativeSmoke } from "../nativeSmoke";
import { rehearseSmoke } from "../smokeRehearsal";

class SmokeFailure extends Schema.TaggedError<SmokeFailure>()("SmokeFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

export const smoke: Command = (args) => Effect.gen(function*() {
  if (args.includes("--native")) return yield* nativeSmoke(args);
  if (args.length > 0) return yield* new UsageFailure({ problem: "smoke takes no arguments, or --native --pair K [--map MAP.w3x] [--shard N...]" });
  const verdicts = smokePairs().map(([first, second]) => rehearseSmoke(PLAYABLE_CHARACTERS[first] ?? Character.rifleman, PLAYABLE_CHARACTERS[second] ?? Character.rifleman));
  const all = mergeVerdicts(verdicts);
  const receipt = smokeReceipt(all, PLAYABLE_CHARACTERS.length);
  yield* Console.log(receipt);
  for (const line of smokeLines(all)) if (!line.startsWith("PASS")) yield* Console.log(line);
  if (!receipt.endsWith("pass=1")) return yield* new SmokeFailure({ problem: "a move or key failed in the headless smoke rehearsal" });
});
