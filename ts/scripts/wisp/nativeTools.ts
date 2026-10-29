import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { basename, delimiter, join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "../hostProcess";
import { projectRoot } from "./project";
import { ensurePackager } from "wisp/scripts/wisp/mapBuild";

export class NativeToolMissing extends Schema.TaggedError<NativeToolMissing, { readonly brand: unique symbol }>()("NativeToolMissing", {
  tools: Schema.Array(Schema.String), problem: Schema.String,
}) {
  override get message(): string { return `native tool${this.tools.length === 1 ? "" : "s"} ${this.tools.join(", ")} unavailable: ${this.problem}`; }
}

export class NativeClientInvalid extends Schema.TaggedError<NativeClientInvalid, { readonly brand: unique symbol }>()("NativeClientInvalid", {
  client: Schema.String, problem: Schema.String,
}) {
  override get message(): string { return `client ${this.client}: ${this.problem}`; }
}

/** Each tool the native checks drive, with the nixpkgs attribute that provides it. */
export const NATIVE_TOOLS: Readonly<Record<string, string>> = {
  grim: "grim",
  xdotool: "xdotool",
  wlrctl: "wlrctl",
  tesseract: "tesseract",
  nsenter: "util-linux.bin",
};

/** Screen recording tools, resolved only by the commands that record video. */
export const VIDEO_TOOLS: Readonly<Record<string, string>> = {
  "wf-recorder": "wf-recorder",
  ffmpeg: "ffmpeg-headless",
  ffprobe: "ffmpeg-headless",
};

const MAP_PACKER = join(projectRoot, "build/tools/map-pack");

const standardDirectories = () => [
  "/run/wrappers/bin",
  join(homedir(), ".nix-profile/bin"),
  "/nix/profile/bin",
  `/etc/profiles/per-user/${userInfo().username}/bin`,
  "/nix/var/nix/profiles/default/bin",
  "/run/current-system/sw/bin",
];

export interface ToolSources {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly which: (name: string) => string | null;
  readonly build: (attribute: string) => Effect.Effect<string, unknown>;
}

const liveSources: ToolSources = {
  env: process.env,
  which: (name) => Bun.which(name, { PATH: [...(process.env["PATH"] ?? "").split(delimiter), ...standardDirectories()].join(delimiter) }),
  build: (attribute) => runProcess(ChildProcess.make("nix", ["build", "--no-link", "--print-out-paths", `nixpkgs#${attribute}`], { stdin: "ignore" })).pipe(
    Effect.map((out) => out.split("\n")[0] ?? ""),
    Effect.provide(BunServices.layer),
  ),
};

/** Resolves every native tool at run time: WISP_<NAME>, then the caller's PATH and the system profiles, then a nixpkgs build; never a path stored in a clients file. */
export const resolveTools = (names: readonly string[] = Object.keys(NATIVE_TOOLS), sources: ToolSources = liveSources) => Effect.gen(function*() {
  const found: Record<string, string> = {};
  const problems: string[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const attribute = NATIVE_TOOLS[name] ?? VIDEO_TOOLS[name] ?? name;
    const given = sources.env[`WISP_${name.toUpperCase()}`];
    const onPath = given !== undefined && given !== "" ? given : sources.which(name);
    if (onPath !== null && existsSync(onPath)) {
      found[name] = onPath;
      continue;
    }
    const built = yield* sources.build(attribute).pipe(Effect.map((root) => join(root, "bin", name)), Effect.catch((cause) => Effect.sync(() => {
      problems.push(`${name}: ${String(cause)}`);
      return undefined;
    })));
    if (built !== undefined && existsSync(built)) found[name] = built;
    else missing.push(name);
  }
  if (missing.length > 0) return yield* new NativeToolMissing({ tools: missing, problem: `not on PATH or in the system profiles, and \`nix build nixpkgs#<attribute>\` produced none${problems.length === 0 ? "" : ` (${problems.join("; ")})`}` });
  return found as Readonly<Record<string, string>>;
});

const KNOWN_PREFIX = /^(clone-[a-d]|lan\d+[ab])$/;

/** The Wine prefix folder a client's Documents path lives in. */
export const prefixOf = (documents: string): string | undefined => {
  const at = documents.indexOf("/pfx/");
  return at < 0 ? undefined : basename(documents.slice(0, at));
};

interface ClientEntry { readonly name: string; readonly documents: string; readonly offline?: boolean }

/** Refuses a client whose Documents prefix doesn't exist or isn't one of the account clones or pool clients, so a name like `a` can't launch an unrelated prefix. */
export const validateClients = (clients: readonly ClientEntry[], exists: (path: string) => boolean = existsSync) => Effect.gen(function*() {
  const seen = new Set<string>();
  for (const { name, documents } of clients) {
    if (seen.has(name)) return yield* new NativeClientInvalid({ client: name, problem: "listed twice" });
    seen.add(name);
    const prefix = prefixOf(documents);
    if (prefix === undefined || !KNOWN_PREFIX.test(prefix)) return yield* new NativeClientInvalid({ client: name, problem: `its Documents folder ${documents} isn't inside a clone-[a-d] or lan<N>[ab] prefix` });
    if (!exists(documents)) return yield* new NativeClientInvalid({ client: name, problem: `prefix ${prefix} has no Documents folder at ${documents}` });
  }
});

/** The clients file with its stored tools replaced by this run's resolved ones. */
export const withRuntimeTools = (clientsJson: string, tools: Readonly<Record<string, string>>): string => {
  const parsed: unknown = JSON.parse(clientsJson);
  const base = typeof parsed === "object" && parsed !== null ? parsed : {};
  return `${JSON.stringify({ ...base, tools }, null, 2)}\n`;
};

export const onlyClient = (clientsJson: string, name: string): string => {
  const parsed: unknown = JSON.parse(clientsJson);
  if (typeof parsed !== "object" || parsed === null || !("clients" in parsed) || !Array.isArray(parsed.clients)) return clientsJson;
  return JSON.stringify({ ...parsed, clients: parsed.clients.filter((entry: unknown) => typeof entry === "object" && entry !== null && "name" in entry && entry.name === name) });
};

export const readClientEntries = (path: string): readonly ClientEntry[] => {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const clients = typeof parsed === "object" && parsed !== null && "clients" in parsed && Array.isArray(parsed.clients) ? parsed.clients : [];
  return clients.flatMap((entry: unknown) => typeof entry === "object" && entry !== null && "name" in entry && "documents" in entry
    && typeof entry.name === "string" && typeof entry.documents === "string"
    ? [{ name: entry.name, documents: entry.documents, ...("offline" in entry && entry.offline === true ? { offline: true } : {}) }]
    : []);
};

export const unresolvedLibraries = (lddOutput: string): readonly string[] =>
  lddOutput.split("\n").flatMap((line) => /^\s*(\S+) => not found/.exec(line)?.[1] ?? []);

const liveLdd = (path: string) => runProcess(ChildProcess.make("ldd", [path], { stdin: "ignore" })).pipe(Effect.provide(BunServices.layer));

/** Drops the packager's source stamp when a library it links has left the store, so Wisp's own check recompiles it against the current stormlib. */
export const repairPackager = (packer = MAP_PACKER, ldd: (path: string) => Effect.Effect<string, unknown> = liveLdd) => Effect.gen(function*() {
  if (!existsSync(packer)) return false;
  const missing = unresolvedLibraries(yield* ldd(packer).pipe(Effect.orElseSucceed(() => "")));
  if (missing.length === 0) return false;
  rmSync(`${packer}.source-sha256`, { force: true });
  console.log(`map packager misses ${missing.join(", ")}; it will be recompiled against the current stormlib`);
  return true;
});

export const readyPackager = (packer = MAP_PACKER) => repairPackager(packer).pipe(Effect.andThen(ensurePackager(packer)));
