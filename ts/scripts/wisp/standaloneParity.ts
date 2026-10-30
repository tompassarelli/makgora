import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Effect, Schema } from "effect";
import { parseReplay } from "../../src/game/replay/matchReplay";
import { assembleReplays, CHECKED_IN_CORPUS, findRecordings, joinedLines, localCorpus } from "./corpus";
import { NEUTRAL_INPUT, createStandaloneSession } from "./standalone";
import { tsDirectory } from "./project";

export class StandaloneParityFailure extends Schema.TaggedError<StandaloneParityFailure, { readonly brand: unique symbol }>()("StandaloneParityFailure", {
  problem: Schema.String,
}) {
  override get message(): string {
    return this.problem;
  }
}

const PRESENTATIONS = ["native", "pool-confirmed", "pool-predicted"] as const;
type Presentation = typeof PRESENTATIONS[number];

const DEFAULT_PRESENTATIONS: readonly Presentation[] = ["native", "pool-predicted"];

export function standaloneParityArguments(args: readonly string[]): { readonly pad: string; readonly presentations: readonly Presentation[] } | string {
  let pad: string | undefined;
  let presentations = DEFAULT_PRESENTATIONS;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--presentation") {
      const names = args[++index]?.split(",") ?? [];
      const unknown = names.find((name): name is string => !PRESENTATIONS.some((known) => known === name));
      if (names.length === 0 || unknown !== undefined) return `--presentation needs ${PRESENTATIONS.join(", ")} separated by commas`;
      presentations = PRESENTATIONS.filter((known) => names.includes(known));
    } else if (arg === undefined || arg.startsWith("--") || pad !== undefined) return `unknown standalone option: ${arg}`;
    else pad = arg;
  }
  return pad === undefined ? "parity standalone takes a pad script" : { pad, presentations };
}

const nativeDigests = (pad: string, presentation: Presentation) => Effect.gen(function*() {
  const roots = [CHECKED_IN_CORPUS, localCorpus()];
  const recordings = roots.flatMap(findRecordings).filter((recording) => recording.session.pad === pad && recording.session.presentation === presentation);
  const recording = recordings[recordings.length - 1];
  if (recording === undefined) return yield* new StandaloneParityFailure({ problem: `no native recording of ${pad} under ${presentation} in the corpus (session.json names its pad and presentation)` });
  const replay = assembleReplays([recording]).replays[0];
  if (replay === undefined) return yield* new StandaloneParityFailure({ problem: `${recording.id} holds no finished replay` });
  const lines = joinedLines(replay);
  const parsed = typeof lines === "string" ? lines : parseReplay(lines);
  if (typeof parsed === "string") return yield* new StandaloneParityFailure({ problem: `${recording.id}: ${parsed}` });
  const digests = new Map<number, string>();
  for (const segment of parsed.segments) segment.digests.forEach((digest, index) => digests.set(segment.start + index + 1, digest));
  if (digests.size === 0) return yield* new StandaloneParityFailure({ problem: `${recording.id} recorded no frame digests (a build without the dev console)` });
  return { recording: recording.id, digests };
});

const playPad = (script: string, presentation: Presentation, native: ReadonlyMap<number, string>) => Effect.tryPromise({
  try: async () => {
    const last = Math.max(...native.keys());
    const session = await createStandaloneSession({ script, presentation });
    try {
      let compared = 0, divergent = 0;
      let first: string | undefined;
      while (session.digest().frame < last) {
        session.step(NEUTRAL_INPUT);
        const { frame, digest } = session.digest();
        const recorded = native.get(frame);
        if (recorded === undefined) continue;
        compared++;
        if (recorded === digest) continue;
        divergent++;
        first ??= `first divergent frame ${frame}: digest ${digest}, native ${recorded}: ${session.difference(recorded)}`;
      }
      return { compared, divergent, first };
    } finally {
      session.close();
    }
  },
  catch: (cause) => new StandaloneParityFailure({ problem: `the standalone run under ${presentation} stopped: ${String(cause)}` }),
});

export const standaloneParity = (args: readonly string[]) => Effect.gen(function*() {
  const parsed = standaloneParityArguments(args);
  if (typeof parsed === "string") return yield* new StandaloneParityFailure({ problem: parsed });
  const path = resolve(parsed.pad);
  const pad = relative(tsDirectory, path);
  const script = yield* Effect.try({ try: () => readFileSync(path, "utf8"), catch: (cause) => new StandaloneParityFailure({ problem: `${path}: ${String(cause)}` }) });
  let failed = 0;
  for (const presentation of parsed.presentations) {
    const native = yield* nativeDigests(pad, presentation);
    const result = yield* playPad(script, presentation, native.digests);
    const ok = result.divergent === 0 && result.compared === native.digests.size;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${pad} under ${presentation} (native ${native.recording}): ${result.compared}/${native.digests.size} frames compared, ${result.divergent} divergent${result.first === undefined ? "" : `: ${result.first}`}`);
  }
  if (failed > 0) return yield* new StandaloneParityFailure({ problem: `the standalone window differs from the native client under ${failed} presentations` });
});
