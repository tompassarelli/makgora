import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { judgeAccount, judgeRun } from "../scripts/wisp/commands/animJudgeRun";

const sessionConfigDir = process.env.CLAUDE_CONFIG_DIR;
const restoreConfigDir = () => { if (sessionConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = sessionConfigDir; };

const FAKE_CLAUDE = `#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
writeFileSync(process.env.FAKE_CLAUDE_DIR + "/argv.json", JSON.stringify(process.argv.slice(2)));
writeFileSync(process.env.FAKE_CLAUDE_DIR + "/stdin.json", await Bun.stdin.text());
writeFileSync(process.env.FAKE_CLAUDE_DIR + "/config-dir.txt", process.env.CLAUDE_CONFIG_DIR ?? "");
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
    process.env.CLAUDE_CONFIG_DIR = directory;
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
    restoreConfigDir();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the bare judge defaults to the arm the calibration picked, Sonnet at medium effort, with a fresh judge id per run [k3 measure #558]", async () => {
  const directory = mkdtempSync(join(tmpdir(), "judge-arm-"));
  try {
    const image = join(directory, "one.png");
    writeFileSync(image, Uint8Array.from([137, 80, 78, 71]));
    writeFileSync(join(directory, "batch-1.md"), `# batch\n\n- Murloc (\`murloc\`), \`dash-attack\`: ${image}\n  Upper rows, ours: frames 0, 1.\n`);
    const claude = join(directory, "claude");
    writeFileSync(claude, FAKE_CLAUDE);
    chmodSync(claude, 0o755);
    process.env.FAKE_CLAUDE_DIR = directory;
    process.env.CLAUDE_CONFIG_DIR = directory;
    await Effect.runPromise(judgeRun([directory, "--claude", claude]));
    const argv = JSON.parse(readFileSync(join(directory, "argv.json"), "utf8")) as string[];
    expect(argv[argv.indexOf("--model") + 1]).toBe("sonnet");
    expect(argv[argv.indexOf("--effort") + 1]).toBe("medium");
    const scores = readdirSync(directory).filter((name) => /^scores-bare-sonnet-medium-.+\.jsonl$/.test(name));
    expect(scores).toHaveLength(1);
  } finally {
    delete process.env.FAKE_CLAUDE_DIR;
    restoreConfigDir();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the bare judge spends the calling session's Claude account, names it, and refuses rather than fall back to the host's default login [k5 boundary judge-claude-account]", async () => {
  const root = mkdtempSync(join(tmpdir(), "judge-account-"));
  const profile = join(root, "claude-c");
  try {
    mkdirSync(profile);
    expect(judgeAccount({ CLAUDE_CONFIG_DIR: profile })).toEqual({ name: "c", configDir: profile });
    expect(judgeAccount({})).toContain("CLAUDE_CONFIG_DIR is not set");
    expect(judgeAccount({ CLAUDE_CONFIG_DIR: join(root, "claude-z") })).toContain("does not exist");
    const image = join(root, "one.png");
    writeFileSync(image, Uint8Array.from([137, 80, 78, 71]));
    writeFileSync(join(root, "batch-1.md"), `# batch\n\n- Murloc (\`murloc\`), \`dash-attack\`: ${image}\n  Upper rows, ours: frames 0, 1.\n`);
    const claude = join(root, "claude");
    writeFileSync(claude, FAKE_CLAUDE);
    chmodSync(claude, 0o755);
    process.env.FAKE_CLAUDE_DIR = root;
    delete process.env.CLAUDE_CONFIG_DIR;
    const refused = await Effect.runPromise(Effect.flip(judgeRun([root, "--claude", claude])));
    expect(refused.message).toContain("CLAUDE_CONFIG_DIR is not set");
    expect(existsSync(join(root, "config-dir.txt"))).toBe(false);
    process.env.CLAUDE_CONFIG_DIR = profile;
    await Effect.runPromise(judgeRun([root, "--claude", claude]));
    expect(readFileSync(join(root, "config-dir.txt"), "utf8")).toBe(profile);
  } finally {
    delete process.env.FAKE_CLAUDE_DIR;
    restoreConfigDir();
    rmSync(root, { recursive: true, force: true });
  }
});
