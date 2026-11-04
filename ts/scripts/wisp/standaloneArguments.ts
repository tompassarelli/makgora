import { devCommandsOf } from "./devArguments";
import { STAGE_CATALOG, type StageTile } from "../../src/game/menu/stageCatalog";
import type { MapBuild } from "../../src/game/session/build";

export type StandaloneStart = "match" | "training" | "select" | "results";

const squashed = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The stage tile a `--stage` name picks, read without case, spaces or punctuation, so "tomb-of-sargeras" is Tomb of Sargeras. */
export function stageNamed(name: string): StageTile {
  const found = STAGE_CATALOG.find(stage => squashed(stage.name) === squashed(name));
  if (found === undefined) throw new Error(`--stage names no stage: ${name}; the stages are ${STAGE_CATALOG.map(stage => stage.name).join(", ")}`);
  return found.id;
}

const FLAGS = new Set(["--headless", "--four-fighters", "--player-assets-only", "--no-tutorial-offer"]);
const TEXT_OPTIONS = new Set(["--script", "--map", "--out", "--start", "--chosen", "--digests", "--storage", "--stage", "--dev"]);

type Presentation = MapBuild["presentation"];

interface ParsedOptions {
  readonly flags: ReadonlySet<string>;
  readonly texts: ReadonlyMap<string, string>;
  readonly frames: number | undefined;
  readonly rollback: number | undefined;
  readonly presentation: Presentation | undefined;
  readonly captureFrames: readonly number[];
}

function presentationOf(value: string): Presentation {
  if (value !== "native" && value !== "pool-confirmed" && value !== "pool-predicted") throw new Error("--presentation needs native, pool-confirmed or pool-predicted");
  return value;
}

function positiveCount(option: "--frames" | "--rollback", value: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1) throw new Error(`${option} needs a positive frame count`);
  return Number(value);
}

function frameList(value: string): number[] {
  if (!/^\d+(,\d+)*$/.test(value)) throw new Error("--capture-frames needs comma-separated frame numbers");
  return value.split(",").map(Number);
}

function parseOptions(args: readonly string[]): ParsedOptions {
  let frames: number | undefined, rollback: number | undefined;
  let presentation: Presentation | undefined;
  const flags = new Set<string>(), texts = new Map<string, string>();
  const captureFrames: number[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = String(args[index]);
    if (arg === "--standalone") continue;
    if (FLAGS.has(arg)) { flags.add(arg); continue; }
    if (!TEXT_OPTIONS.has(arg) && arg !== "--frames" && arg !== "--rollback" && arg !== "--capture-frames" && arg !== "--presentation") throw new Error(`unknown standalone option: ${arg}`);
    const value = args[++index];
    if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value`);
    if (TEXT_OPTIONS.has(arg)) texts.set(arg, value);
    else if (arg === "--presentation") presentation = presentationOf(value);
    else if (arg === "--frames") frames = positiveCount(arg, value);
    else if (arg === "--rollback") rollback = positiveCount(arg, value);
    else captureFrames.push(...frameList(value));
  }
  return { flags, texts, frames, rollback, presentation, captureFrames };
}

export function standaloneArguments(args: readonly string[], window: "chrome" | "native" = "native") {
  const { flags, texts, frames, rollback, presentation, captureFrames } = parseOptions(args);
  const startOptions = startArguments(texts);
  const devCommands = devCommandsOf(texts.get("--dev"));
  const script = texts.get("--script"), digests = digestsOf(texts, window), out = texts.get("--out"), map = texts.get("--map"), storage = texts.get("--storage"), headless = flags.has("--headless"), fourFighters = flags.has("--four-fighters");
  if (headless && (frames === undefined || (out === undefined && window === "chrome"))) throw new Error(window === "native" ? "--headless needs --frames N" : "--headless needs --frames N and --out DIR");
  const playerAssets = playerAssetsOf(flags.has("--player-assets-only"), map);
  if (fourFighters && script !== undefined) throw new Error("--four-fighters plays its own inputs; drop --script");
  const stageName = texts.get("--stage");
  if (stageName !== undefined && !fourFighters) throw new Error("--stage picks the --four-fighters match's stage; add --four-fighters");
  const stage = stageName === undefined ? undefined : stageNamed(stageName);
  return { ...(fourFighters ? { fourFighters } : {}), ...(flags.has("--no-tutorial-offer") ? { noTutorialOffer: true } : {}), devCommands, ...(stage === undefined ? {} : { stage }), ...(rollback === undefined ? {} : { rollback }), ...(storage === undefined ? {} : { storage }), ...startOptions, ...playerAssets, ...(script === undefined ? {} : { script }), ...digests, ...(presentation === undefined ? {} : { presentation }), ...(out === undefined ? {} : { out }), ...(frames === undefined ? {} : { frames }), headless, ...(captureFrames.length === 0 ? {} : { captureFrames }) };
}

function digestsOf(texts: ReadonlyMap<string, string>, window: "chrome" | "native"): { readonly digests?: string } {
  const digests = texts.get("--digests");
  if (digests !== undefined && window !== "native") throw new Error("--digests is written by the native window; drop --window chrome");
  return digests === undefined ? {} : { digests };
}

function startArguments(texts: ReadonlyMap<string, string>): { readonly start?: StandaloneStart; readonly chosen?: string } {
  const start = texts.get("--start"), chosen = texts.get("--chosen");
  if (start !== undefined && start !== "match" && start !== "training" && start !== "select" && start !== "results") throw new Error("--start needs match, training, select or results");
  if (chosen !== undefined && start !== "select") throw new Error("--chosen needs --start select");
  return { ...(start === undefined ? {} : { start }), ...(chosen === undefined ? {} : { chosen }) };
}

function playerAssetsOf(playerAssetsOnly: boolean, map: string | undefined): { readonly playerAssets?: { readonly map: string } } {
  if (map === undefined) {
    if (playerAssetsOnly) throw new Error("--player-assets-only reads the map's files; add --map MAP.w3x");
    return {};
  }
  if (!playerAssetsOnly) throw new Error("--map is read only with --player-assets-only");
  return { playerAssets: { map } };
}
