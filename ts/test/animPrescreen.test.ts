import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { Effect } from "effect";
import { projectRoot } from "../scripts/wisp/project";
import { PRESCREEN_FILE, prescreenJudge, prescreenVerdict } from "../scripts/wisp/commands/animPrescreen";

const JUDGE_FILE = join(projectRoot, "tools/move-data/anim-score/judge.jsonl");
const sessionConfigDir = process.env.CLAUDE_CONFIG_DIR;

const fakeClaude = (scores: string) => `#!/usr/bin/env bun
await Bun.stdin.text();
console.log(JSON.stringify({ type: "result", is_error: false, duration_ms: 1, usage: { input_tokens: 1, output_tokens: 1 },
  result: '${scores}' }));
`;

const screen = async (scores: string) => {
  const directory = mkdtempSync(join(tmpdir(), "prescreen-"));
  try {
    const image = join(directory, "one.png");
    writeFileSync(image, Uint8Array.from([137, 80, 78, 71]));
    writeFileSync(join(directory, "batch-1.md"), `# batch\n\n- Murloc (\`murloc\`), \`dash-attack\`: ${image}\n  Upper rows, ours: frames 0, 1.\n`);
    const claude = join(directory, "claude");
    writeFileSync(claude, fakeClaude(scores));
    chmodSync(claude, 0o755);
    process.env.CLAUDE_CONFIG_DIR = directory;
    const resultFile = join(directory, "results", "prescreen.jsonl");
    const result = await Effect.runPromise(prescreenJudge(directory, { fighter: "murloc", move: "dash-attack", stopBelow: 3, claude, resultFile, renderSeconds: 1 }));
    return { result, row: JSON.parse(readFileSync(resultFile, "utf8").trim()) as Record<string, unknown> };
  } finally {
    if (sessionConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = sessionConfigDir;
    rmSync(directory, { recursive: true, force: true });
  }
};

test("a pre-screen never writes a scorecard judgement row: a stop or a go only appends to its own file, because the scorecard counts judge.jsonl rows and a pre-screen row there would count as a judgement that native capture and three viewers must give [k5 boundary prescreen-no-judgement]", async () => {
  const before = existsSync(JUDGE_FILE) ? readFileSync(JUDGE_FILE, "utf8") : undefined;
  const stopped = await screen('{"readability":2,"weight":2,"anticipation":3,"followThrough":2,"character":2,"note":"flat"}');
  const went = await screen('{"readability":5,"weight":5,"anticipation":5,"followThrough":5,"character":5,"note":"great"}');
  expect(stopped.result.verdict).toBe("stop");
  expect(went.result.verdict).toBe("go");
  expect(stopped.row).toMatchObject({ fighter: "murloc", move: "dash-attack", verdict: "stop", scores: [2, 2, 3, 2, 2] });
  expect(PRESCREEN_FILE).not.toBe(JUDGE_FILE);
  expect(relative(join(projectRoot, "tools/move-data/anim-score"), PRESCREEN_FILE).startsWith("..")).toBe(true);
  expect(existsSync(JUDGE_FILE) ? readFileSync(JUDGE_FILE, "utf8") : undefined).toBe(before);
});

test("the pre-screen stops only below its threshold and a borderline take goes on to native [k3 measure #614]", () => {
  const lines = (value: number) => ({ readability: value, weight: value, anticipation: value, followThrough: value, character: value });
  expect(prescreenVerdict(lines(2), 3).verdict).toBe("stop");
  expect(prescreenVerdict(lines(3), 3).verdict).toBe("go");
  expect(prescreenVerdict({ ...lines(4), weight: 3 }, 3).verdict).toBe("go");
  expect(prescreenVerdict({ ...lines(3), weight: 1 }, 3).verdict).toBe("stop");
});
