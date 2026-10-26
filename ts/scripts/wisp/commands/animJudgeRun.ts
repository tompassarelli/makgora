import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Console, Effect, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { runProcess } from "../../hostProcess";
import { projectRoot } from "../project";

const MODELS = ["haiku", "sonnet", "opus"] as const;
/** The arm the calibration test of #557 picked for scorecard line 5 (proxy decision, 2026-10-26). */
export const JUDGE_ARM = { model: "sonnet", effort: "medium" } as const;
export function borderlineNotice(judged: readonly ({ readonly count: number; readonly needed: number } | undefined)[]): string[] {
  const borderline = judged.filter((line) => line !== undefined && line.count < line.needed).length;
  return borderline === 0 ? [] : [`${borderline} moves are borderline on line 5 (a score within half a point of the 4/5 bar); judge them again with bun wisp anim judge run PRIVATE_DIR (${JUDGE_ARM.model}, ${JUDGE_ARM.effort} effort), then anim judge record`];
}

const EFFORTS = ["low", "medium", "high"] as const;
const SYSTEM = "You are a strict, independent animation judge. You see only the images attached to the message.";
const REPLY = `Reply with exactly one line of JSON and nothing else: {"readability":N,"weight":N,"anticipation":N,"followThrough":N,"character":N,"note":"one sentence"}, each N an integer 1-5. The images are attached in order, so do not try to open files.`;

class JudgeRunFailure extends Schema.TaggedError<JudgeRunFailure>()("JudgeRunFailure", { problem: Schema.String }) { override get message(): string { return this.problem; } }
const attempt = <A>(problem: string, run: () => Promise<A> | A) =>
  Effect.tryPromise({ try: async () => run(), catch: (cause) => new JudgeRunFailure({ problem: `${problem}: ${cause instanceof Error ? cause.message : String(cause)}` }) });

const Verdict = Schema.Struct({
  readability: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 })), weight: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 })),
  anticipation: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 })), followThrough: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 })),
  character: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 })), note: Schema.String,
});
const decodeVerdict = Schema.decodeUnknownEffect(Schema.fromJsonString(Verdict));

export interface BatchItem { readonly fighter: string; readonly move: string; readonly images: readonly string[]; readonly caption: string }

export function parseBatch(text: string): BatchItem[] {
  const items: BatchItem[] = [];
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    const match = /^- .*\(`([^`]+)`\), `([^`]+)`: (.+)$/.exec(line);
    if (match === null) continue;
    items.push({ fighter: match[1] ?? "", move: match[2] ?? "", images: (match[3] ?? "").split(" then "), caption: (lines[index + 1] ?? "").trim() });
  }
  return items;
}

export function claudeArguments(model: string, effort: string | undefined): string[] {
  return ["-p", "--model", model, ...(effort === undefined ? [] : ["--effort", effort]), "--tools", "", "--setting-sources", "", "--strict-mcp-config", "--no-session-persistence",
    "--system-prompt", SYSTEM, "--input-format", "stream-json", "--output-format", "stream-json", "--verbose"];
}

export function judgeMessage(brief: string, item: BatchItem, images: readonly Uint8Array[]): string {
  const content = [
    { type: "text", text: `${brief}\n\n## Your move\n\n\`${item.fighter}\`, \`${item.move}\`: ${images.length} image${images.length === 1 ? "" : "s"}, read in order.\n${item.caption}\n\n${REPLY}` },
    ...images.map((bytes) => ({ type: "image", source: { type: "base64", media_type: "image/png", data: Buffer.from(bytes).toString("base64") } })),
  ];
  return `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`;
}

const Result = Schema.Struct({
  type: Schema.Literal("result"), is_error: Schema.Boolean, result: Schema.String, duration_ms: Schema.Finite,
  usage: Schema.Struct({ input_tokens: Schema.Finite, output_tokens: Schema.Finite, cache_creation_input_tokens: Schema.optional(Schema.Finite), cache_read_input_tokens: Schema.optional(Schema.Finite) }),
});

export function parseResult(stdout: string): { readonly reply: string; readonly tokens: number; readonly outputTokens: number; readonly millis: number } | undefined {
  for (const line of stdout.split("\n").reverse()) {
    if (!line.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      if ((parsed as { type?: string }).type !== "result") continue;
      const result = Schema.decodeUnknownSync(Result)(parsed);
      if (result.is_error) return undefined;
      const usage = result.usage;
      return { reply: result.result, tokens: usage.input_tokens + usage.output_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0), outputTokens: usage.output_tokens, millis: result.duration_ms };
    } catch { return undefined; }
  }
  return undefined;
}

const verdictText = (reply: string) => /\{[\s\S]*\}/.exec(reply)?.[0] ?? reply;

const ask = (binary: string, args: readonly string[], input: string) =>
  runProcess(ChildProcess.make(binary, args, { stdin: Stream.make(new TextEncoder().encode(input)) })).pipe(Effect.mapError((cause) => new JudgeRunFailure({ problem: `run claude: ${cause.message}` })));

const judgeOne = (directory: string, binary: string, args: readonly string[], brief: string, item: BatchItem) => Effect.gen(function*() {
  const images = yield* attempt(`read the images of ${item.fighter}/${item.move}`, () => Promise.all(item.images.map(async (path) => new Uint8Array(await Bun.file(path).arrayBuffer()))));
  const input = judgeMessage(brief, item, images);
  const started = performance.now();
  for (let tries = 0; ; tries++) {
    const parsed = parseResult(yield* ask(binary, args, input));
    const verdict = parsed === undefined ? undefined : yield* decodeVerdict(verdictText(parsed.reply)).pipe(Effect.option);
    if (parsed !== undefined && verdict?._tag === "Some") return { item, verdict: verdict.value, tokens: parsed.tokens, outputTokens: parsed.outputTokens, seconds: (performance.now() - started) / 1000, tries: tries + 1 };
    if (tries >= 1) return yield* new JudgeRunFailure({ problem: `${item.fighter}/${item.move}: no valid scores after ${tries + 1} calls (${directory})` });
  }
});

export const judgeRun: Command = (args) => Effect.gen(function*() {
  const [directory, ...rest] = args;
  const flags = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index], value = rest[index + 1];
    if (flag === undefined || value === undefined || !["--model", "--effort", "--judge", "--parallel", "--claude"].includes(flag)) { flags.clear(); break; }
    flags.set(flag, value);
  }
  const chosen = !flags.has("--model") && !flags.has("--effort"), model = chosen ? JUDGE_ARM.model : flags.get("--model"), effort = chosen ? JUDGE_ARM.effort : flags.get("--effort"), parallel = Number(flags.get("--parallel") ?? "4");
  const usage = "anim judge run PRIVATE_DIR [--model haiku|sonnet|opus] [--effort low|medium|high] [--judge ID] [--parallel N] [--claude BIN]";
  if (directory === undefined || model === undefined || !(MODELS as readonly string[]).includes(model) || (effort !== undefined && !(EFFORTS as readonly string[]).includes(effort)) || !Number.isInteger(parallel) || parallel < 1) return yield* new UsageFailure({ problem: usage });
  const output = resolve(directory);
  const judge = flags.get("--judge") ?? `bare-${model}${effort === undefined ? "" : `-${effort}`}-${Date.now().toString(36)}`;
  const brief = yield* attempt("read the judge brief", () => Bun.file(join(projectRoot, "docs/animation-judge-brief.md")).text());
  const batches = readdirSync(output).filter((name) => /^batch-\d+\.md$/.test(name)).sort();
  const items = (yield* Effect.forEach(batches, (name) => attempt(`read ${name}`, () => Bun.file(join(output, name)).text()))).flatMap(parseBatch);
  if (items.length === 0) return yield* new UsageFailure({ problem: `no batch-N.md with moves in ${output}; run anim judge prepare first` });
  const calls = claudeArguments(model, effort);
  const done = yield* Effect.forEach(items, (item) => judgeOne(output, flags.get("--claude") ?? "claude", calls, brief, { ...item, images: item.images.map((path) => resolve(path)) }), { concurrency: parallel });
  const rows = done.map(({ item, verdict }) => ({ look: "classic", fighter: item.fighter, move: item.move, judge, ...verdict, model, ...(effort === undefined ? {} : { effort }) }));
  const costs = done.map(({ item, tokens, outputTokens, seconds, tries }) => ({ fighter: item.fighter, move: item.move, judge, model, tokens, outputTokens, seconds: Math.round(seconds * 10) / 10, tries }));
  yield* attempt("write the scores", async () => {
    await Bun.write(join(output, `scores-${judge}.jsonl`), rows.map((row) => `${JSON.stringify(row)}\n`).join(""));
    await Bun.write(join(output, `usage-${judge}.jsonl`), costs.map((row) => `${JSON.stringify(row)}\n`).join(""));
  });
  const tokens = costs.reduce((sum, row) => sum + row.tokens, 0), seconds = costs.reduce((sum, row) => sum + row.seconds, 0);
  yield* Console.log(`${rows.length} moves judged by ${judge}: ${Math.round(tokens / rows.length)} tokens and ${(seconds / rows.length).toFixed(1)} s per move; record with: bun wisp anim judge record ${join(output, `scores-${judge}.jsonl`)}`);
}).pipe(Effect.provide(BunServices.layer));
