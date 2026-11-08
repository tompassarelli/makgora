import { devQuery } from "./devArguments";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { RenderFailure } from "wisp/scripts/wisp/headlessRender";
import { headlessRender, playerRender } from "./headlessRender";
import { standaloneArguments } from "./standaloneArguments";
import { makgoraStandalone } from "./standaloneGame";
import { createStandaloneSession } from "./standalone";

// a compiled player embeds its entrypoints as .js
const NATIVE_GAME_MODULE = join(import.meta.dir, import.meta.path.endsWith(".ts") ? "nativeGame.ts" : "nativeGame.js");

export const standalonePlay: Command = (args) => Effect.gen(function*() {
  const { runStandalone, standaloneEmulatedCallsArgument, standaloneNetArguments, standaloneSoundArgument, standaloneWindowArgument } = yield* Effect.tryPromise({ try: () => import("wisp/scripts/wisp/standalone"), catch: (cause) => new RenderFailure({ cause }) });
  const net = standaloneNetArguments(args);
  if (typeof net === "string") return yield* new UsageFailure({ problem: net });
  const windowed = standaloneWindowArgument(net.rest);
  if (typeof windowed === "string") return yield* new UsageFailure({ problem: windowed });
  const heard = standaloneSoundArgument(windowed.rest);
  const counted = standaloneEmulatedCallsArgument(heard.rest);
  if (typeof counted === "string") return yield* new UsageFailure({ problem: counted });
  const options = yield* Effect.try({ try: () => standaloneArguments(counted.rest, windowed.window), catch: (cause) => new UsageFailure({ problem: String(cause) }) });
  const { playerAssets, start, chosen, digests, storage, stage, rollback, fourFighters, noTutorialOffer, devCommands, ...run } = options;
  const match = { ...(fourFighters === true ? { fourFighters } : {}), ...(stage === undefined ? {} : { stage }), ...(rollback === undefined ? {} : { rollback }) };
  const game = makgoraStandalone(playerAssets === undefined ? headlessRender() : yield* playerRender(playerAssets.map).pipe(Effect.mapError((cause) => new RenderFailure({ cause }))));
  const query = new URLSearchParams();
  if (playerAssets !== undefined) query.set("map", playerAssets.map);
  if (options.start !== undefined) query.set("start", options.start);
  if (!options.headless) query.set("save", "1");
  if (chosen !== undefined) query.set("chosen", chosen);
  if (noTutorialOffer === true) query.set("noTutorialOffer", "1");
  if (options.presentation !== undefined) query.set("presentation", options.presentation);
  if (options.fourFighters === true) query.set("fourFighters", "1");
  if (options.stage !== undefined) query.set("stage", String(options.stage));
  if (options.rollback !== undefined) query.set("rollback", String(options.rollback));
  devQuery(query, devCommands);
  if (digests !== undefined) query.set("digests", digests);
  const compiled = !import.meta.path.endsWith(".ts");
  if (compiled) process.env.MAKGORA_NATIVE_QUERY = query.toString();
  if (windowed.window === "native") process.env.WISP_WINDOW_SNAPSHOTS ??= join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "makgora/evidence");
  const nativeModule = query.size === 0 || compiled ? NATIVE_GAME_MODULE : `${NATIVE_GAME_MODULE}?${query}`;
  return yield* runStandalone({ ...game, create: (session) => createStandaloneSession({ ...session, ...(options.presentation === undefined ? {} : { presentation: options.presentation }), ...match, ...(start === undefined ? {} : { start }), ...(chosen === undefined ? {} : { chosen }), ...(noTutorialOffer === true ? { tutorialOffer: false } : {}), devCommands }) }, {
    ...run,
    reforged: storage === undefined ? {} : { storage },
    ...(playerAssets === undefined ? {} : { gpuLease: false }),
    ...(counted.emulatedCalls === undefined ? {} : { emulatedCalls: counted.emulatedCalls }),
    ...(net.net === undefined ? {} : { net: net.net }),
    window: windowed.window,
    ...(heard.sound ? { sound: true } : {}),
    ...(windowed.window === "native" ? { nativeGame: { module: nativeModule, export: "MAKGORA_NATIVE_GAME" } } : {}),
  });
});
