import { type Command, UsageFailure, flagValues } from "wisp/scripts/wisp/command";
import { lan as frameworkLan } from "wisp/scripts/wisp/commands/lan";
import { lanSoak } from "./lanSoak";
import { withQuietNativeCapacity } from "wisp/scripts/wisp/quietNativeCapacity";
import { poolStart, poolStop, userManager } from "./lanPoolUnit";
import { assertPairClaim, claimPair, releasePair } from "./pairClaim";
import { Effect } from "effect";
import { runProcess } from "../../hostProcess";
import { BunServices } from "@effect/platform-bun";

const claim = (args: readonly string[]) => Effect.gen(function*() {
  const [pairText] = flagValues(args, "pair");
  const [owner] = flagValues(args, "owner");
  const pair = Number(pairText);
  const session = process.env["NORTH_FLEET_SESSION"] ?? "";
  if (pairText === undefined || !/^\d+$/.test(pairText) || owner === undefined) return yield* new UsageFailure({ problem: "claim requires --pair N --owner NAME" });
  const unit = `smashcraft-lan-pool-${pair}`;
  const pidText = yield* runProcess(userManager("systemctl", ["--user", "show", unit, "--property=MainPID", "--value"])).pipe(Effect.mapError(cause => new UsageFailure({ problem: `read ${unit} owner: ${cause.message}` })));
  const pid = Number(pidText.trim());
  if (!Number.isInteger(pid) || pid <= 1) return yield* new UsageFailure({ problem: `pair ${pair} has no active pool unit ${unit}` });
  yield* Effect.try({ try: () => claimPair(pair, owner, session, pid), catch: cause => new UsageFailure({ problem: String(cause) }) });
  console.log(`pair ${pair} claimed by ${owner} (fleet session ${session}, pool pid ${pid})`);
}).pipe(Effect.asVoid, Effect.provide(BunServices.layer));

const release = (args: readonly string[]) => Effect.gen(function*() {
  const [pairText] = flagValues(args, "pair");
  if (pairText === undefined || !/^\d+$/.test(pairText)) return yield* new UsageFailure({ problem: "release requires --pair N" });
  yield* poolStop(["--pair", pairText]);
  yield* Effect.try({ try: () => releasePair(Number(pairText), process.env["NORTH_FLEET_SESSION"] ?? ""), catch: cause => new UsageFailure({ problem: String(cause) }) });
}).pipe(Effect.asVoid);

export const claimedLanPair = (args: readonly string[]): number | undefined => {
  if (args[0] !== "fresh" && args[0] !== "end") return undefined;
  const pairFlag = args.find((arg) => arg === "--pair" || arg.startsWith("--pair="));
  if (pairFlag === undefined) return 0;
  const value = pairFlag === "--pair" ? args[args.indexOf(pairFlag) + 1] : pairFlag.slice("--pair=".length);
  return value === undefined || !/^\d+$/.test(value) ? undefined : Number(value);
};

export const lan: Command = (args) => {
  switch (args[0]) {
    case "soak": return withQuietNativeCapacity("smashcraft-lan-soak", lanSoak(args.slice(1)));
    case "pool": return poolStart(args.slice(1));
    case "stop": return poolStop(args.slice(1));
    case "claim": return claim(args.slice(1));
    case "release": return release(args.slice(1));
    case "fresh":
    case "end": {
      const pair = claimedLanPair(args);
      if (pair === 0) {
        try { assertPairClaim(0, process.env["NORTH_FLEET_SESSION"] ?? ""); }
        catch (cause) { return Effect.fail(new UsageFailure({ problem: String(cause) })); }
      }
      return frameworkLan(args);
    }
    default: return frameworkLan(args);
  }
};
