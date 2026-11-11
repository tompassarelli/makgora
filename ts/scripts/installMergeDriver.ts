const NAME = "per-entry merge of generated files";
const DRIVER = 'f=ts/scripts/mergeGenerated.ts; if [ -f "$f" ]; then bun "$f" %O %A %B %P; else git merge-file -L ours -L base -L theirs %A %O %B; fi';

const git = (...args: string[]) => Bun.spawnSync(["git", ...args], { stdin: "ignore", stdout: "pipe", stderr: "inherit" });

const ensure = (key: string, value: string): void => {
  const held = git("config", "--get", key);
  if (held.exitCode === 0 && held.stdout.toString().trimEnd() === value) return;
  const wrote = git("config", key, value);
  if (wrote.exitCode !== 0) process.exit(wrote.exitCode ?? 1);
};

if (import.meta.main) {
  ensure("merge.makgora-generated.name", NAME);
  ensure("merge.makgora-generated.driver", DRIVER);
}
