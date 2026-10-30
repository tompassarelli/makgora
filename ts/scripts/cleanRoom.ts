import { join } from "node:path";
import { Console, Effect } from "effect";
import { type Policy, cleanRoom } from "wisp/scripts/cleanRoom";

export const SMASHCRAFT_POLICY: Policy = { origins: ["original", "generated", "stock-path"] };

export const REACH_EXEMPT = ["ts/scripts/cleanRoom.ts", "ts/test/clean-room.test.ts"];

const REACH_SCAN_BYTES = 2_000_000;

const OFFSET = String.raw`x(?!(?:11|32|64|86)(?![0-9A-F]))[0-9A-F]{2,4}`;

export const REACH_RULES: readonly { readonly name: string; readonly pattern: RegExp; readonly within?: RegExp }[] = [
  { name: "a game-binary address or offset", pattern: /\bRVA\b|\+0x[0-9a-fA-F]{2,}\b|\b0x0*6[fF]{3}[0-9a-fA-F]{8}\b|\b0x80(?!000000\b)[0-9a-fA-F]{6}\b|\b80(?=[0-9A-F]*[A-F])[0-9A-F]{6}\b/ },
  { name: "a decompiled symbol name", pattern: /\b(?![a-zA-Z]{2,4}_80)[a-zA-Z][a-zA-Z0-9]*_80[0-9A-F]{6}\b|\b(?:ft|gr|it|mp|cm|lb|gm|pl|ef|mn|db)[A-Z]?[A-Za-z0-9]*_[A-Z][A-Za-z0-9_]*\b/ },
  { name: "a Melee game-file name", pattern: /\bPlCo\b|\b(?:Pl|Gr|Ty|If|Mn|Ef)[A-Z][A-Za-z0-9]{0,3}\.dat\b|GALE01|\bmain\.dol\b|\byakumono_param\b|\b(?:rframe|rradd)_[a-z]/ },
  { name: "a decompiled function or source file", pattern: /\b\w+_GObjProc\b|\bFighter_proc[A-Z]\w*|\bftCo_|\bbury_timer|\b(?:gr|ft|it|lb|mp|gm)[a-z]{4,}\.c\b(?![\w(])|\bft\/kinds\// },
  { name: "an offset-named game field", pattern: new RegExp(String.raw`(?<![\\\w%])${OFFSET}_[A-Za-z]|[\x60"'.]${OFFSET}[\x60"']|(?<![\\\w%])x(?=[0-9A-F]{0,3}[A-F])[0-9A-F]{2,4}\b|\bftData[\s_]${OFFSET}\b`), within: /x[0-9A-F]{2}/ },
  { name: "a retail-file source", pattern: /\bcoll_data\b|\bretail-(?:roster|action-lengths)\b/ },
  { name: "an extraction or decompilation cited as a source", pattern: /\b(?:NTSC|PAL|1\.02|disc|retail|cited|Melee)\b[\w. '-]{0,24}?\bextract(?:ion|ed)\b|\b(?:from|per|cited?|via|in) (?:the |Melee's )?decomp(?:ilation|iled)?\b/i },
];

export const REACH_ALLOWLIST: readonly { readonly path: string; readonly rule: string; readonly reason: string }[] = [
  { path: "docs/delivery-goal.md", rule: "an extraction or decompilation cited as a source", reason: "states the clean-room policy and cites nothing" },
  { path: "ts/src/game/sim/stageHazards.ts", rule: "a Melee game-file name", reason: "the barrel cannon's citations, removed by its relaunch rework (sc-cannon-launch, 2026-10-31)" },
  { path: "ts/src/game/sim/stageHazards.ts", rule: "a decompiled function or source file", reason: "the barrel cannon's citations, removed by its relaunch rework (sc-cannon-launch, 2026-10-31)" },
  { path: "docs/stage-hazards.md", rule: "a Melee game-file name", reason: "the barrel cannon's citations, removed by its relaunch rework (sc-cannon-launch, 2026-10-31)" },
  { path: "docs/stage-hazards.md", rule: "a decompiled function or source file", reason: "the barrel cannon's citations, removed by its relaunch rework (sc-cannon-launch, 2026-10-31)" },
  { path: "repos/effect/pnpm-lock.yaml", rule: "an offset-named game field", reason: "upstream Effect lockfile: a base64 integrity hash ending in x and hex-looking characters" },
];

const allowed = (path: string, rule: string) => REACH_ALLOWLIST.some((entry) => entry.path === path && entry.rule === rule);

export interface Line { readonly path: string; readonly line: number; readonly text: string }

export function reachProblems(lines: readonly Line[]): string[] {
  return lines.filter(({ path }) => !REACH_EXEMPT.includes(path)).flatMap(({ path, line, text }) => REACH_RULES
    .filter(({ name, pattern }) => !allowed(path, name) && pattern.test(text))
    .map(({ name }) => `clean room: ${path}:${line} has ${name}. Measure from outside the game instead (README "Principles").`));
}

const reach = (root: string) => Effect.promise(async () => {
  const listed = Bun.spawnSync(["git", "-C", root, "ls-files", "-z"]);
  const lines: Line[] = [];
  for (const path of listed.stdout.toString().split("\0").filter((path) => path !== "")) {
    const file = Bun.file(join(root, path));
    if (file.size > REACH_SCAN_BYTES) continue;
    const bytes = await file.bytes().catch(() => new Uint8Array());
    if (bytes.includes(0)) continue;
    const text = new TextDecoder().decode(bytes);
    if (!REACH_RULES.some(({ pattern, within }) => (within?.test(text) ?? true) && pattern.test(text))) continue;
    text.split("\n").forEach((text, index) => lines.push({ path, line: index + 1, text }));
  }
  return reachProblems(lines);
});

const check = (root: string) => Effect.gen(function*() {
  const problems = [...yield* cleanRoom(root, SMASHCRAFT_POLICY), ...yield* reach(root)];
  if (problems.length === 0) return yield* Console.log("clean room: no game files, copied game scripts, memory access, game addresses, offset-named fields, retail-file sources or decompiled symbols outside the allowlist");
  yield* Effect.forEach(problems, (problem) => Console.error(problem), { discard: true });
  process.exit(1);
});

if (import.meta.main) await Effect.runPromise(check(join(import.meta.dir, "../..")));
