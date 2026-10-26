import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { judgeRun } from "../scripts/wisp/commands/animJudgeRun";

const FAKE_CLAUDE = `#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
writeFileSync(process.env.FAKE_CLAUDE_DIR + "/argv.json", JSON.stringify(process.argv.slice(2)));
writeFileSync(process.env.FAKE_CLAUDE_DIR + "/stdin.json", await Bun.stdin.text());
console.log(JSON.stringify({ type: "result", is_error: false, duration_ms: 12, usage: { input_tokens: 3, output_tokens: 5, cache_read_input_tokens: 100 },
  result: '{"readability":4,"weight":3,"anticipation":5,"followThrough":4,"character":2,"note":"fine"}' }));
`;

test("the bare judge call gives claude no tools, settings or session and the move's two images in one message, and records the scores with the model [k5 boundary judge-claude-call]", async () => {
  const directory = mkdtempSync(join(tmpdir(), "judge-run-"));
  try {
    const images = [join(directory, "one.png"), join(directory, "two.png")];
    for (const path of images) writeFileSync(path, Uint8Array.from([137, 80, 78, 71]));
    writeFileSync(join(directory, "batch-1.md"), `# batch\n\n- Murloc (\`murloc\`), \`dash-attack\`: ${images.join(" then ")}\n  Upper rows, ours: frames 0, 1.\n`);
    const claude = join(directory, "claude");
    writeFileSync(claude, FAKE_CLAUDE);
    chmodSync(claude, 0o755);
    process.env.FAKE_CLAUDE_DIR = directory;
    await Effect.runPromise(judgeRun(["" + directory, "--model", "haiku", "--effort", "low", "--judge", "bare-test", "--claude", claude]));
    const argv = JSON.parse(readFileSync(join(directory, "argv.json"), "utf8")) as string[];
    expect(argv[argv.indexOf("--tools") + 1]).toBe("");
    expect(argv[argv.indexOf("--setting-sources") + 1]).toBe("");
    expect(argv).toContain("--strict-mcp-config");
    expect(argv).toContain("--no-session-persistence");
    expect(argv[argv.indexOf("--model") + 1]).toBe("haiku");
    expect(argv[argv.indexOf("--effort") + 1]).toBe("low");
    const message = JSON.parse(readFileSync(join(directory, "stdin.json"), "utf8")) as { message: { content: { type: string }[] } };
    expect(message.message.content.filter((part) => part.type === "image")).toHaveLength(2);
    const [row] = readFileSync(join(directory, "scores-bare-test.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(row).toMatchObject({ look: "classic", fighter: "murloc", move: "dash-attack", judge: "bare-test", character: 2, model: "haiku", effort: "low" });
  } finally {
    delete process.env.FAKE_CLAUDE_DIR;
    rmSync(directory, { recursive: true, force: true });
  }
});
