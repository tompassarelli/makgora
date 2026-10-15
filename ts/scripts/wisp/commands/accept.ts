





import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Clock, type Duration, Effect, Layer, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { AcceptDriver, AcceptFailure, type AcceptSuite, type ReceiptFile, selectChecks } from "wisp/scripts/wisp/accept";
import type { Frame } from "wisp/scripts/wisp/frameProbe";
import { liveAcceptDriver } from "wisp/scripts/wisp/acceptLive";
import { spawnLogged } from "wisp/scripts/wisp/hostProcess";
import { Clients } from "wisp/scripts/wisp/clients";
import { type Command, UsageFailure, flagValues, describeCause } from "wisp/scripts/wisp/command";
import { makeAccept } from "wisp/scripts/wisp/commands/accept";
import { lan } from "wisp/scripts/wisp/commands/lan";
import { step } from "wisp/scripts/wisp/timings";
import { GameFiles } from "wisp/scripts/wisp/gameFiles";
import { Phase } from "../../../src/game/lobby/lobbyState";
import { MAP_PROFILES, SMASHCRAFT_ACCEPT, type SmashcraftMapProfile } from "../acceptChecks";
import { DevCommandReceipt } from "../boundary";
import { rebuildMap } from "../mapInputs";
import { clientState, gameFilesLayer } from "../project";
import { clientArguments } from "./client";
import { freshMatch, readyAfter, sendDevCommand } from "./fresh";
import { profileOptions } from "./map";
import { onHealthyClients, readClientsFile, smashcraftWatch } from "../doctor";
import { LAN_POOL_FILE, lanPairs, withTools } from "../padBatch";
import { platformLayer } from "wisp/scripts/platform/layer";
import { preferencesPath, videoSettings } from "wisp/scripts/warcraft/preferences";
import { measureCursorGate } from "../gateCursor";
import { measureStartGate } from "../gateStart";
import { measureBindingsGate } from "../gateBindings";

const ReportMetadata = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

const candidateIdentity = (candidate: string, clientsFile: string) => Effect.try({
  try: () => {
    const looks = readClientsFile(clientsFile).clients.map(client => videoSettings(readFileSync(preferencesPath(client.documents), "utf8"), "Misc").hd);
    if (looks.length === 0 || looks.some(look => look !== "0")) throw new Error("Classic gate requires every client's Misc.hd=0");
    return { candidateMapSha256: createHash("sha256").update(readFileSync(candidate)).digest("hex"), graphicsLook: "classic" as const };
  },
  catch: cause => new AcceptFailure({ operation: "identify gate candidate", problem: describeCause(cause) }),
});

const bindCandidateReport = (directory: string, candidate: string, clientsFile: string, identity: Effect.Success<ReturnType<typeof candidateIdentity>>, since: number) => Effect.gen(function*() {
  const path = join(directory, "report.json");
  if (!existsSync(path)) return;
  const text = yield* Effect.try({ try: () => readFileSync(path, "utf8"), catch: cause => new AcceptFailure({ operation: "read candidate report", problem: describeCause(cause) }) });
  const report = yield* Schema.decodeEffect(ReportMetadata)(text).pipe(Effect.mapError(cause => new AcceptFailure({ operation: "decode candidate report", problem: cause.message })));
  if (typeof report.started !== "number" || report.started < since) return yield* new AcceptFailure({ operation: "bind candidate report", problem: "no report written by this acceptance run" });
  const after = yield* candidateIdentity(candidate, clientsFile);
  if (after.candidateMapSha256 !== identity.candidateMapSha256) return yield* new AcceptFailure({ operation: "bind candidate report", problem: "candidate bytes changed during acceptance" });
  yield* Effect.try({
    try: () => writeFileSync(path, `${JSON.stringify({ ...report, ...identity }, null, 2)}\n`, { mode: 0o600 }),
    catch: cause => new AcceptFailure({ operation: "bind candidate report", problem: describeCause(cause) }),
  });
});


const clientNames = (clientsFile: string): [string, ...string[]] => {
  try {
    const [first, ...rest] = readClientsFile(clientsFile).clients.map(({ name }) => name);
    return first === undefined ? ["a", "b"] : [first, ...rest];
  } catch {
    return ["a", "b"];
  }
};


export const acceptForClients = (suite: AcceptSuite, clients: readonly [string, ...string[]]): AcceptSuite => {
  const rename = <T extends { readonly client?: string }>(entry: T): T => entry.client === undefined ? entry : {
    ...entry, client: entry.client === "a" ? clients[0] : entry.client === "b" ? clients[1] ?? clients[0] : entry.client,
  };
  return { ...suite, checks: suite.checks.map(check => ({ ...check,
    ...(check.setup === undefined ? {} : { setup: check.setup.map(step => "client" in step ? rename(step) : step) }),
    ...(check.capture === undefined ? {} : { capture: check.capture.map(rename) }),
    ...(check.pass === undefined ? {} : { pass: check.pass.map(rule => "client" in rule ? rename(rule) : rule) }),
  })) };
};


export const acceptForSoloClients = (suite: AcceptSuite, clients: readonly [string, ...string[]]): AcceptSuite => ({
  ...acceptForClients(suite, clients),
  checks: acceptForClients(suite, clients).checks.map(check => ({ ...check,
    ...(check.setup === undefined ? {} : { setup: check.setup.flatMap(step =>
      ("chat" in step || "keys" in step) && step.client === undefined ? clients.map(client => ({ ...step, client })) : [step]) }),
  })),
});

export const sendSoloDevCommand = (command: string, name?: string) => Effect.gen(function*() {
  const clients = yield* Clients;
  yield* Effect.forEach(clients.all.filter(client => name === undefined || client.name === name), client =>
    sendDevCommand(command, client.name).pipe(Effect.provideService(Clients, { ...clients, all: [client] })), { discard: true });
});

const fighterCount = (mask: number) => {
  let count = 0;
  for (let rest = mask; rest > 0; rest >>= 1) count += rest & 1;
  return count;
};

const REPLAY_NAME = /^smashcraft-replay-(\d+)(-\d+)?\.txt$/;







const matchEnd = (receipts: readonly ReceiptFile[], since: number) => {
  const recent = receipts.flatMap(({ name, modified }) => {
    const match = modified > since ? REPLAY_NAME.exec(name) : null;
    return match === null ? [] : [{ name, serial: Number(match[1]), manifest: match[2] === undefined }];
  });
  const current = Math.max(...recent.map(({ serial }) => serial));
  return recent.find(({ serial, manifest }) => manifest && serial === current);
};






export const smokeProblem = (frame: Frame, receipts: readonly ReceiptFile[], since: number) => Effect.gen(function*() {
  const quick = receipts.filter(({ name }) => name.startsWith("smashcraft-dev-")).sort((a, b) => b.modified - a.modified)[0];
  if (quick === undefined) return "two fighters present: the host wrote no quick-match receipt";
  const setup = yield* DevCommandReceipt.decode(quick.name, quick.text).pipe(Effect.option);
  if (setup._tag === "None") return `two fighters present: ${quick.name} doesn't read as a quick-match receipt`;
  const fighters = fighterCount(setup.value.humanFighters | setup.value.computers);
  if (fighters < 2) return `two fighters present: the match has ${fighters} fighter${fighters === 1 ? "" : "s"}`;
  const ended = matchEnd(receipts, since);
  if (setup.value.phase !== Phase.match || ended !== undefined) return `match still running: the match had already ended${ended === undefined ? "" : ` (${ended.name})`}`;
  let low = 765;
  let high = 0;
  const step = Math.max(1, Math.floor(frame.width * frame.height / 4096)) * 3;
  for (let index = 0; index + 2 < frame.rgb.length; index += step) {
    const value = (frame.rgb[index] ?? 0) + (frame.rgb[index + 1] ?? 0) + (frame.rgb[index + 2] ?? 0);
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  if (frame.rgb.length === 0 || high - low < 24) return "frame not blank: the host's frame is one flat colour";
  return undefined;
});






export const withSmokeCapture = (driver: AcceptDriver["Service"], settle: Duration.Input = "2 seconds") => {
  let smoked = false;
  let failed: string | undefined;
  const stopped = () => new AcceptFailure({ operation: "smoke capture", problem: `${failed ?? ""}; the batch stopped` });
  return {
    failed: () => failed,
    driver: AcceptDriver.of({
      ...driver,
      prepare: Effect.suspend(() => failed === undefined ? driver.prepare : Effect.fail(stopped())),
      start: (map, session) => Effect.gen(function*() {
        if (failed !== undefined) return yield* stopped();
        const since = yield* Clock.currentTimeMillis;
        yield* driver.start(map, session);
        if (smoked) return;
        smoked = true;
        yield* Effect.sleep(settle);
        const host = driver.clients[0];
        failed = yield* smokeProblem(yield* driver.capture(host), yield* driver.receipts(host), since);
        if (failed !== undefined) return yield* stopped();
      }),
    }),
  };
};








const PREBUILT = "SMASHCRAFT_ACCEPT_PREBUILT";


const selectedPairs = (args: readonly string[]) => Effect.try({
  try: () => {
    const ids = flagValues(args, "pair");
    const [count] = flagValues(args, "pairs");
    if (ids.some((id) => !/^\d+$/.test(id))) throw new Error("--pair takes an offline pool pair number");
    if (count !== undefined && !/^[1-9]\d*$/.test(count)) throw new Error("--pairs takes a number of pairs");
    if (count !== undefined && ids.length > 0) throw new Error("--pairs and --pair don't combine");
    if (count === undefined) return ids;
    return lanPairs(LAN_POOL_FILE, { count: Number(count) }).map(({ lan }) => String(lan));
  },
  catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
});

const withoutPairFlags = (args: readonly string[]) => args.filter((arg, index) => !["--pair", "--pairs"].includes(arg) && !arg.startsWith("--pair=") && !arg.startsWith("--pairs=") && !["--pair", "--pairs"].includes(args[index - 1] ?? ""));


const prebuild = (maps: readonly string[], profiles: Readonly<Record<string, SmashcraftMapProfile>>) => Effect.forEach([...new Map(maps.flatMap((map) => {
  const profile = profiles[map];
  return profile?.rebuild === undefined ? [] : [[profile.path, profile.rebuild] as const];
}))], ([path, rebuild]) => Effect.gen(function*() {
  const options = yield* profileOptions(["--profile", rebuild]);
  yield* rebuildMap(path).pipe(step(`map rebuilt (${path})`), Effect.provide(options.services));
}), { discard: true });






export const runShard = (pair: string, ids: readonly string[], directory: string, map?: string) => Effect.scoped(Effect.gen(function*() {
  yield* Effect.try({ try: () => mkdirSync(directory, { recursive: true }), catch: (cause) => new AcceptFailure({ operation: `pair ${pair}`, problem: describeCause(cause) }) });
  const { handle, written } = yield* spawnLogged(ChildProcess.make(process.execPath, [join(import.meta.dir, "../../wisp.ts"), "accept", "--only", ids.join(","), "--pair", pair, "--out", directory, ...(map === undefined ? [] : ["--map", map])], {
    env: { ...process.env, [PREBUILT]: "1" }, stdin: "ignore",
  }), { stdout: `${directory}.log`, stderr: `${directory}.err` });
  const code = yield* handle.exitCode;
  yield* written;
  if (code !== 0) return yield* new AcceptFailure({ operation: `pair ${pair}`, problem: `its accept run exited ${code}; see ${directory}.err` });
})).pipe(
  Effect.catchTag("PlatformError", (cause) => Effect.fail(new AcceptFailure({ operation: `pair ${pair}`, problem: cause.message }))),
  Effect.provide(BunServices.layer),
);

export const accept: Command = (rawArgs) => Effect.gen(function*() {
  const { clientsFile, args } = yield* Effect.try({ try: () => clientArguments(rawArgs), catch: (cause) => cause instanceof UsageFailure ? cause : new UsageFailure({ problem: String(cause) }) });
  const solo = args.includes("--solo");
  const [candidate] = flagValues(args, "map");
  if (candidate !== undefined && !existsSync(candidate)) return yield* new UsageFailure({ problem: `no built map ${candidate}` });
  const profiles: Readonly<Record<string, SmashcraftMapProfile>> = candidate === undefined ? MAP_PROFILES : Object.fromEntries(Object.entries(MAP_PROFILES).map(([name, { rebuild: _rebuild, ...profile }]) => [name, { ...profile, path: candidate }]));
  const suite = { ...SMASHCRAFT_ACCEPT, maps: profiles };
  const requested = yield* selectedPairs(args);
  if (solo && requested.length !== 1) return yield* new UsageFailure({ problem: "--solo requires one --pair K; each client plays its own single-player game" });
  const id = requested.length === 1 ? Number(requested[0]) : undefined;
  const pair = id === undefined ? undefined : yield* Effect.try({
    try: () => {
      const selected = lanPairs(LAN_POOL_FILE, { ids: [id] })[0];
      if (selected === undefined) throw new Error(`no offline pair ${id}`);
      return args.includes("--dry-run") ? selected : withTools(selected, clientState, flagValues(args, "out")[0] ?? join(homedir(), ".local/state/smashcraft/accept", `pair-${id}`));
    },
    catch: cause => new UsageFailure({ problem: describeCause(cause) }),
  });
  if (pair !== undefined && clientsFile !== clientState) return yield* new UsageFailure({ problem: "--clients-file and --pair select different clients; give one" });
  const selectedClients = pair?.clients ?? clientsFile;
  const gate = selectChecks(suite, flagValues(args, "only").flatMap(value => value.split(/[,\s]+/))).checks.some(check => check.id.startsWith("gate-"));
  const identity = candidate === undefined || !gate || args.includes("--dry-run") ? undefined : yield* candidateIdentity(candidate, selectedClients);
  const names = clientNames(selectedClients);
  const withoutMap = args.filter((arg, index) => arg !== "--solo" && arg !== "--map" && !arg.startsWith("--map=") && args[index - 1] !== "--map");
  const forwarded = requested.length > 1 ? withoutMap : withoutPairFlags(withoutMap);
  const rebuilt = new Set<string>();
  const start = (map: string) => Effect.gen(function*() {
    const profile = profiles[map];
    if (profile === undefined) return yield* new AcceptFailure({ operation: "start", problem: `unknown map profile ${map}` });
    const options = yield* profileOptions(profile.rebuild === undefined ? [] : ["--profile", profile.rebuild]);
    yield* Effect.gen(function*() {
      if (profile.rebuild !== undefined && !rebuilt.has(profile.path) && process.env[PREBUILT] === undefined) {
        yield* rebuildMap(profile.path).pipe(step("map rebuilt"));
        rebuilt.add(profile.path);
      }
      if (pair?.lan === undefined) yield* freshMatch(profile.path);
      else {
        const started = yield* Clock.currentTimeMillis;
        yield* lan([solo ? "solo" : "fresh", profile.path, "--pair", String(pair.lan)]);
        const clients = yield* Clients;
        yield* Effect.forEach(clients.all, client => readyAfter(client, started), { concurrency: "unbounded" });
      }
      if (profile.quick !== "") yield* (solo ? sendSoloDevCommand(profile.quick) : sendDevCommand(profile.quick)).pipe(step(profile.quick));
    }).pipe(Effect.provide(Layer.merge(options.services.pipe(Layer.provideMerge(Clients.layer(selectedClients))), smashcraftWatch)));
  });
  const liveDriver = liveAcceptDriver({
    start,
    receipt: (name) => name.startsWith("smashcraft-dev-") || name.startsWith("smashcraft-stage-") || name.startsWith("smashcraft-error-") || name.startsWith("smashcraft-render-clock-") || name.startsWith("smashcraft-replay-"),
  }).pipe(Layer.provide(Layer.mergeAll(Clients.layer(selectedClients), gameFilesLayer, smashcraftWatch)));
  let smoke: ReturnType<typeof withSmokeCapture> | undefined;
  const driver = Layer.effect(AcceptDriver, Effect.gen(function*() {
    const live = yield* AcceptDriver;
    const context = yield* Effect.context<Clients | GameFiles>();
    const measurements = new Map<string, ReceiptFile[]>();
    const controlled = AcceptDriver.of({
      ...live,
      chat: (name, text) => text === "gate:cursor" ? measureCursorGate(selectedClients, name, join(flagValues(args, "out")[0] ?? join(homedir(), ".local/state/smashcraft/accept"), "gate-cursor-visible", name)).pipe(
        Effect.tap(receipt => Effect.sync(() => measurements.set(name, [...(measurements.get(name) ?? []), receipt]))), Effect.asVoid, Effect.provide(Layer.mergeAll(BunServices.layer, platformLayer())),
      ) : text === "gate:start" ? measureStartGate(selectedClients, name, join(flagValues(args, "out")[0] ?? join(homedir(), ".local/state/smashcraft/accept"), "gate-start-anywhere", name), controlled.start("gate-playable", "gate-start")).pipe(
        Effect.tap(receipt => Effect.sync(() => measurements.set(name, [...(measurements.get(name) ?? []), receipt]))), Effect.asVoid, Effect.provide(Layer.mergeAll(BunServices.layer, platformLayer())),
      ) : text === "gate:bindings" ? measureBindingsGate(selectedClients, name, join(flagValues(args, "out")[0] ?? join(homedir(), ".local/state/smashcraft/accept"), "gate-bindings", name), pair?.appIds ?? new Map()).pipe(
        Effect.tap(receipt => Effect.sync(() => measurements.set(name, [...(measurements.get(name) ?? []), receipt]))), Effect.asVoid, Effect.provide(Layer.mergeAll(BunServices.layer, platformLayer())),
      ) : (solo ? sendSoloDevCommand(text, name) : sendDevCommand(text, name)).pipe(Effect.mapError((cause) => new AcceptFailure({ operation: `chat ${name}`, problem: describeCause(cause) })), Effect.provide(context)),
      receipts: name => Effect.map(live.receipts(name), receipts => [...receipts, ...(measurements.get(name) ?? [])]),
    });
    const validated = withSmokeCapture(controlled);
    smoke = validated;
    if (gate) return AcceptDriver.of({ ...validated.driver, start: (map, session) => map === "gate-playable" ? controlled.start(map, session) : validated.driver.start(map, session) });
    return smoke.driver;
  })).pipe(Layer.provide(liveDriver), Layer.provide(Layer.mergeAll(Clients.layer(selectedClients), gameFilesLayer, smashcraftWatch)), Layer.provide(platformLayer()));
  const shards = {
    flags: ["--pair", "--pairs"],
    select: () => Effect.succeed(requested),
    prepare: (sessions: readonly { readonly map: string }[]) => prebuild(sessions.map(({ map }) => map), profiles),
    run: (pair: string, ids: readonly string[], directory: string) => runShard(pair, ids, directory, candidate),
  };
  const accepted = makeAccept({ suite: solo ? acceptForSoloClients(suite, names) : acceptForClients(suite, names), evidenceRoot: join(homedir(), ".local/state/smashcraft/accept"), driver, clients: names, shards })(forwarded);

  const smokeStop = () => {
    const failed = smoke?.failed();
    return failed === undefined ? undefined : new AcceptFailure({ operation: "smoke capture", problem: `${failed}; the batch stopped before its checks` });
  };
  const run = accepted.pipe(
    Effect.mapError((cause) => smokeStop() ?? cause),
    Effect.tap(() => {
      const stop = smokeStop();
      return stop === undefined ? Effect.void : Effect.fail(stop);
    }),
  );

  const observed = args.includes("--dry-run") || requested.length > 1 ? run : onHealthyClients(run, { retry: false, clientsFile: selectedClients });
  const [directory] = flagValues(args, "out");
  const since = yield* Clock.currentTimeMillis;
  return yield* (candidate === undefined || directory === undefined || identity === undefined ? observed : observed.pipe(
    Effect.onExit(() => bindCandidateReport(directory, candidate, selectedClients, identity, since)),
  ));
});
