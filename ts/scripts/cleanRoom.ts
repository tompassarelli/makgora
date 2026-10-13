import { join } from "node:path";
import { Console, Effect } from "effect";
import { type Policy, cleanRoom } from "wisp/scripts/cleanRoom";

export const SMASHCRAFT_POLICY: Policy = { origins: ["original", "generated", "stock-path"] };

export const REACH_EXEMPT = ["ts/scripts/cleanRoom.ts", "ts/test/clean-room.test.ts"];

const REACH_SCAN_BYTES = 2_000_000;

export const REACH_RULES: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: "a process-memory API or path", pattern: /\bprocess_vm_(?:readv|writev)\b|\bptrace\b|\/proc\/[^\s/"'`]+\/mem\b|\b(?:Read|Write)ProcessMemory\b|\bVirtualProtectEx\b|\bCreateRemoteThread\b/ },
  { name: "a game-binary address or offset", pattern: /\bRVA\b|\+0x[0-9a-fA-F]{2,}\b|\b0x0*6[fF]{3}[0-9a-fA-F]{8}\b|\b0x80(?!000000\b)[0-9a-fA-F]{6}\b|\b80(?=[0-9A-F]*[A-F])[0-9A-F]{6}\b/ },
  { name: "a decompiled symbol name", pattern: /\b[a-zA-Z][a-zA-Z0-9]*_80[0-9A-F]{6}\b|\b(?:ft|gr|it|mp|cm|lb|gm|pl|ef|mn|db)[A-Z]?[A-Za-z0-9]*_[A-Z][A-Za-z0-9_]*\b/ },
  { name: "a Melee game-file name", pattern: /\bPlCo\b|\bPl[A-Z][a-z]\.dat\b|GALE01|\bmain\.dol\b/ },
  { name: "an import of wisp-private code", pattern: /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["'][^"']*wisp-private/ },
];

export interface Line { readonly path: string; readonly line: number; readonly text: string }

export function reachProblems(lines: readonly Line[]): string[] {
  return lines.filter(({ path }) => !REACH_EXEMPT.includes(path)).flatMap(({ path, line, text }) => REACH_RULES
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => `clean room: ${path}:${line} has ${name}. Measure from outside the game instead (README "Respecting Blizzard's and Nintendo's IP").`));
}

const reach = (root: string) => Effect.promise(async () => {
  const listed = Bun.spawnSync(["git", "-C", root, "ls-files", "-z"]);
  const lines: Line[] = [];
  for (const path of listed.stdout.toString().split("\0").filter((path) => path !== "")) {
    const file = Bun.file(join(root, path));
    if (file.size > REACH_SCAN_BYTES) continue;
    const bytes = await file.bytes().catch(() => new Uint8Array());
    if (bytes.includes(0)) continue;
    new TextDecoder().decode(bytes).split("\n").forEach((text, index) => lines.push({ path, line: index + 1, text }));
  }
  return reachProblems(lines);
});

const check = (root: string) => Effect.gen(function*() {
  const problems = [...yield* cleanRoom(root, SMASHCRAFT_POLICY), ...yield* reach(root)];
  if (problems.length === 0) return yield* Console.log("clean room: no game files, copied game scripts, memory access, game addresses or decompiled symbols outside the allowlist");
  yield* Effect.forEach(problems, (problem) => Console.error(problem), { discard: true });
  process.exit(1);
});

if (import.meta.main) await Effect.runPromise(check(join(import.meta.dir, "../..")));
