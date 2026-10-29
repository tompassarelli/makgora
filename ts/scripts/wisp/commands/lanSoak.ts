import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Console, Effect, Schedule, Schema } from "effect";
import { type Command, UsageFailure, flagValues, wholeFlag, describeCause } from "wisp/scripts/wisp/command";
import { lan as frameworkLan } from "wisp/scripts/wisp/commands/lan";
import { fresh } from "./fresh";
import { agentSocket, readPool } from "wisp/scripts/wisp/lan/pool";
import { dataDirectory } from "wisp/scripts/wisp/gameFiles";
import { batch, loadClients } from "wisp/scripts/warcraft/desktop";
import { ClientWatch } from "wisp/scripts/wisp/watch";
import { openObservedChat } from "wisp/scripts/wisp/chatSetup";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { nativeChatEntryReceipt } from "../boundary";
import { currentChatEntry } from "../padChat";
import { onHealthyClients } from "../doctor";
import { pollUntil } from "../../hostPoll";
import { NATIVE_SOAK_FILE, nativeChatFile } from "../../../src/game/core/gameFiles";
import { INTEGRITY_BUILD } from "../../../src/game/session/currentBuild";

class NativeSoakFailure extends Schema.TaggedError<NativeSoakFailure, { readonly brand: unique symbol }>()("NativeSoakFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}

const attempt = <A>(operation: string, run: () => A) => Effect.try({ try: run, catch: (cause) => new NativeSoakFailure({ problem: `${operation}: ${describeCause(cause)}` }) });
const number = Schema.FiniteFromString;
const counters = { callbacks: number, frames: number, matches: number, results: number, phase: number, stage: number, characters: Schema.String, cpu: number, handles: number };
const Snapshot = Schema.Union([
  Schema.Struct({ ...counters, heapKb: number.check(Schema.isGreaterThanOrEqualTo(0)), heapKbAbsent: Schema.optionalKey(Schema.Never) }),
  Schema.Struct({ ...counters, heapKb: Schema.optionalKey(Schema.Never), heapKbAbsent: Schema.Literals(["no-collectgarbage"]) }),
]);
const warcraftPid = (documents: string): number | undefined => {
  const prefix = documents.split("/pfx/")[0];
  let best: { pid: number; rss: number } | undefined;
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      if (!/_retail_.*Warcraft III\.exe/.test(readFileSync(`/proc/${entry}/cmdline`, "latin1").replaceAll("\0", " "))) continue;
      if (!readFileSync(`/proc/${entry}/environ`, "latin1").split("\0").some((variable) => variable === `STEAM_COMPAT_DATA_PATH=${prefix}` || variable === `STEAM_COMPAT_DATA_PATH=${prefix}/`)) continue;
      const rss = Number(/^VmRSS:\s+(\d+)\s+kB$/m.exec(readFileSync(`/proc/${entry}/status`, "utf8"))?.[1] ?? 0);
      if (best === undefined || rss > best.rss) best = { pid: Number(entry), rss };
    } catch { continue; }
  }
  return best?.pid;
};
const heapLabel = (row: typeof Snapshot.Type): string => row.heapKb === undefined ? `n/a (${row.heapKbAbsent})` : (row.heapKb / 1024).toFixed(3);
const Status = Schema.Struct({ clients: Schema.Array(Schema.Struct({ name: Schema.String, pid: Schema.optional(Schema.Int) })), game: Schema.optional(Schema.Unknown) });

interface Sample {
  readonly elapsed: number;
  readonly client: string;
  readonly rssMiB: number;
  readonly snapshot: typeof Snapshot.Type;
}

const slope = (samples: readonly Sample[], value: (sample: Sample) => number): number => {
  const x = samples.reduce((sum, sample) => sum + sample.elapsed, 0) / samples.length;
  const y = samples.reduce((sum, sample) => sum + value(sample), 0) / samples.length;
  const divisor = samples.reduce((sum, sample) => sum + (sample.elapsed - x) ** 2, 0);
  return divisor === 0 ? 0 : samples.reduce((sum, sample) => sum + (sample.elapsed - x) * (value(sample) - y), 0) / divisor * 3600;
};

export const lanSoak: Command = (args) => Effect.gen(function*() {
  const map = args[0];
  const diagnosticStart = args.includes("--diagnostic-start");
  const pair = wholeFlag(args, "pair");
  const [signedIn] = flagValues(args, "clients");
  const minutes = wholeFlag(args, "minutes", { min: 1, max: 1440 });
  const [outText] = flagValues(args, "out");
  if (pair instanceof UsageFailure) return yield* pair;
  if (minutes instanceof UsageFailure) return yield* minutes;
  if (map === undefined || !existsSync(map) || (pair === undefined) === (signedIn === undefined) || minutes === undefined || outText === undefined) return yield* new UsageFailure({ problem: "lan soak MAP.w3x (--pair K | --clients FILE) --minutes N --out DIR [--diagnostic-start] (an integrity map or named soak diagnostic)" });
  const out = resolve(outText);
  const label = signedIn === undefined ? `pair ${pair}` : "signed-in clients";
  const pool = signedIn === undefined ? yield* readPool : undefined;
  const selected = signedIn === undefined ? pool?.pairs.find((entry) => entry.id === pair) : { clients: resolve(signedIn) };
  if (selected === undefined) return yield* new NativeSoakFailure({ problem: `pair ${pair} is not running; start the assigned pair with lan pool` });
  const status = signedIn !== undefined || pair === undefined ? { clients: [] as readonly { readonly name: string; readonly pid?: number | undefined }[], game: undefined } : yield* Effect.tryPromise({ try: () => fetch("http://pair/status", { unix: agentSocket(pair) }).then((response) => response.json()), catch: (cause) => new NativeSoakFailure({ problem: `pair ${pair} status: ${describeCause(cause)}` }) }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Status)), Effect.mapError((cause) => cause instanceof NativeSoakFailure ? cause : new NativeSoakFailure({ problem: cause.message })));
  if (signedIn === undefined && (status.game !== undefined || status.clients.length !== 2 || status.clients.some((client) => client.pid === undefined))) return yield* new NativeSoakFailure({ problem: `pair ${pair} must have two live offline clients at their menus and no active game` });
  yield* attempt("prepare output", () => { mkdirSync(out, { recursive: true }); if (existsSync(join(out, "samples.tsv"))) throw new Error("samples.tsv already exists; choose a new run directory"); });
  const samples: Sample[] = [];
  const started = performance.now();
  const since = Date.now();
  const run = Effect.gen(function*() {
    if (signedIn === undefined) {
      yield* frameworkLan(["fresh", resolve(map), "--pair", String(pair)]);
      yield* Effect.addFinalizer(() => frameworkLan(["end", "--pair", String(pair)]).pipe(Effect.catch((cause) => Console.error(`${label} cleanup: ${cause.message}`))));
    } else yield* fresh([resolve(map), "--no-quick", "--clients-file", resolve(signedIn)]);
    const clients = yield* loadClients(selected.clients);
    const host = clients[0];
    if (host === undefined || clients.length !== 2) return yield* new NativeSoakFailure({ problem: "the selected pair does not resolve to two clients" });
    if (!diagnosticStart) {
      const chatPath = join(dataDirectory(host.documents), nativeChatFile(INTEGRITY_BUILD.id, 0));
      const entry = attempt("read chat entry", () => {
        if (!existsSync(chatPath)) return undefined;
        return currentChatEntry(nativeChatEntryReceipt(readFileSync(chatPath, "latin1")), statSync(chatPath).mtimeMs, INTEGRITY_BUILD.id, since);
      });
      yield* openObservedChat(host, entry, batch(host, [{ kind: "keys", keys: ["Return"] }]).pipe(Effect.mapError((cause) => new NativeSoakFailure({ problem: cause.message }))));
      yield* batch(host, [{ kind: "text", text: "-dev soak", delayMillis: 35 }, { kind: "keys", keys: ["Return"], settleMillis: 0 }]);
    }
    const lastSnapshots = new Map<string, string>();
    const failure = (problem: string) => new NativeSoakFailure({ problem: `${problem}\n${clients.map((client) => `${client.name}: ${join(dataDirectory(client.documents), NATIVE_SOAK_FILE)}: ${lastSnapshots.get(client.documents) ?? "no snapshot read"}`).join("\n")}` });
    const snapshot = (documents: string) => attempt("read native soak snapshot", () => {
      const path = join(dataDirectory(documents), NATIVE_SOAK_FILE);
      if (!existsSync(path)) { if (!lastSnapshots.has(documents)) lastSnapshots.set(documents, "file missing"); return undefined; }
      const modified = statSync(path).mtimeMs;
      const lines = preloadLines(readFileSync(path, "latin1"));
      lastSnapshots.set(documents, `mtime=${modified} ageMs=${Date.now() - modified}; ${lines?.join("; ") ?? "invalid Preload record"}`);
      if (modified < since || Date.now() - modified > 3000) return undefined;
      const line = lines?.find((text) => text.startsWith("soak "));
      return line === undefined ? undefined : Object.fromEntries(line.substring(5).split(" ").map((field) => field.split("=")));
    }).pipe(Effect.flatMap((value) => value === undefined ? Effect.undefined : Schema.decodeUnknownEffect(Snapshot)(value)), Effect.mapError((cause) => failure(cause.message)));
    yield* pollUntil(Effect.forEach(clients, (client) => snapshot(client.documents)).pipe(Effect.map((rows) => rows.every((row) => row !== undefined && row.cpu === 15 && (row.phase === 2 || row.phase === 3) && row.handles > 0) ? true : undefined)), { every: "250 millis", within: "20 seconds", orElse: () => Effect.fail(failure("no native snapshot for four CPUs on both clients; requires cpu=15 phase=2|3 handles>0")) });
    const samplingStarted = performance.now();
    const sample = Effect.gen(function*() {
      for (const [slot, client] of clients.entries()) {
        const row = yield* snapshot(client.documents);
        const pid = signedIn === undefined ? status.clients.find((candidate) => candidate.name.endsWith(slot === 0 ? "a" : "b"))?.pid : warcraftPid(client.documents);
        if (row === undefined || row.cpu !== 15 || pid === undefined) return yield* failure(`${client.name}: missing native snapshot or process`);
        const rssMiB = yield* attempt("read Warcraft RSS on pool host", () => {
          const rss = /^VmRSS:\s+(\d+)\s+kB$/m.exec(readFileSync(`/proc/${pid}/status`, "utf8"))?.[1];
          if (rss === undefined) throw new Error(`no RSS for ${client.name}`);
          return Number(rss) / 1024;
        });
        samples.push({ elapsed: (performance.now() - samplingStarted) / 1000, client: client.name, rssMiB, snapshot: row });
      }
      yield* attempt("write samples", () => writeFileSync(join(out, "samples.tsv"), "elapsed_s\tclient\trss_MiB\tlua_MiB\tlive_map_handles\tgame_callbacks\tsim_frames\tmatches\tresults\tphase\tstage\tcharacters\n" + samples.map(({ elapsed, client, rssMiB, snapshot: row }) => [elapsed.toFixed(3), client, rssMiB.toFixed(3), heapLabel(row), row.handles, row.callbacks, row.frames, row.matches, row.results, row.phase, row.stage, row.characters].join("\t")).join("\n") + "\n"));
      yield* Console.log(`${label}: minute ${Math.floor((performance.now() - samplingStarted) / 60000)}, ${samples.length} client samples`);
    });
    yield* sample;
    let intervals = 0;
    yield* sample.pipe(Effect.delay("60 seconds"), Effect.repeat({ schedule: Schedule.spaced("0 millis"), until: () => ++intervals >= minutes }));
    const lines = ["| Client | Samples | After minute 10 | RSS MiB/hour (<32) | Lua heap | Map handles/hour (flat) | Native verdict |", "| --- | --- | --- | --- | --- | --- | --- |"];
    let failed = false;
    for (const client of clients) {
      const own = samples.filter((sample) => sample.client === client.name);
      const after = own.filter((sample) => sample.elapsed >= 600);
      const final = own.at(-1)?.snapshot;
      if (final === undefined || final.matches < 2 || final.results < 1) return yield* failure(`${client.name}: back-to-back match/result/rematch flow was not observed`);
      if (after.length < 3) lines.push(`| ${client.name} | ${own.length} | ${after.length} | — | ${heapLabel(final)} | — | insufficient post-10-minute samples |`);
      else {
        const rss = slope(after, (sample) => sample.rssMiB);
        const handles = slope(after, (sample) => sample.snapshot.handles);
        const pass = rss < 32 && handles <= 0;
        failed ||= !pass;
        lines.push(`| ${client.name} | ${own.length} | ${after.length} | ${rss.toFixed(3)} | ${heapLabel(final)} | ${handles.toFixed(3)} | ${pass ? "pass" : "fail"} |`);
      }
    }
    lines.push("", "The map ledger covers returned effect, unit, timer, sound, trigger and frame handles from diagnostic installation before map startup. Frame subtree destruction releases tracked descendants. Sound ownership ends at KillSoundWhenDone or StopSound(killWhenDone); deferred engine cleanup and unreturned internal handles remain in process RSS.", "", "Each sample is collected on the pool host every 60 seconds of monotonic wall time, with the map's latest periodic-callback/confirmed-frame counters. Matches rotate fighters; existing automatic rematch selects stages without Escape.");
    if (diagnosticStart) lines.push("", "Headless 32-bit Lua heap companion: pending. The existing memory --native-sequence driver requires chat startup; it must support automatic startup before measuring the matching named soak bundle. Native heap is n/a when collectgarbage is absent.");
    else lines.push("", "Headless 32-bit Lua heap companion: pending. Run the same four-CPU automatic-rematch sequence against this revision's build/integrity.lua with:", "", `bun wisp soak memory --native-sequence --bundle build/integrity.lua --minutes ${minutes} --out ${JSON.stringify(join(out, "headless-heap.txt"))} --summary ${JSON.stringify(join(out, "summary.md"))}`, "", "Acceptance also requires the companion's post-minute-10 Lua heap slope below 1 MB per 10 minutes in this summary.");
    yield* attempt("write summary", () => writeFileSync(join(out, "summary.md"), lines.join("\n") + "\n"));
    yield* Console.log(lines.join("\n"));
    yield* Console.log(`elapsed ${((performance.now() - started) / 1000).toFixed(1)} s; ${out}`);
    if (failed) return yield* failure("growth exceeds the stated post-warmup bounds");
  });
  yield* onHealthyClients(Effect.scoped(run).pipe(Effect.provide(ClientWatch.layer({ filePrefix: "smashcraft" }))), { clientsFile: selected.clients, retry: false });
});
