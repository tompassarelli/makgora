



import { replayMatch } from "../../src/game/replay/matchReplay";

const SAMPLE_STEP = 1000;

type Sample = [frame: number, source: string, line: number, self: number, inclusive: number];

function sourceNames(source: string): (this: void, line: number) => string {
  const [file] = source.startsWith("@") ? io.open(source.substring(1), "r") : [undefined];
  const lines = file === undefined ? [] : (file.read("a") ?? "").split("\n");
  file?.close();
  const modules: string[] = [];
  let module = "";
  for (const text of lines) {
    if (text.startsWith('["')) module = text.substring(2, text.indexOf('"', 2));
    modules.push(module);
  }
  return (line) => line < 1 || line > lines.length ? `${source}:${line}` : `${modules[line - 1] ?? ""} ${(lines[line - 1] ?? "").trim()}`;
}

function frameProfiler(text: string) {
  const profiled = new Set<number>();
  for (const frame of text.split(",")) if (frame !== "") profiled.add(Number(frame));
  if (os.getenv("PERF_PROFILE_ALLOC") === "1") collectgarbage("stop");
  const kept: Map<string, Sample>[] = [];
  let instructions = 0;
  let samples: Map<string, Sample> | undefined;
  let sampledFrame = 0;
  debug.sethook(() => {
    instructions += SAMPLE_STEP;
    if (samples === undefined) return;
    const seen = new Set<string>();
    for (let level = 2; ; level++) {
      const info = debug.getinfo(level, "S");
      if (info === undefined) break;
      const key = `${info.source ?? ""}:${info.linedefined ?? 0}`;
      let entry = samples.get(key);
      if (entry === undefined) {
        entry = [sampledFrame, info.source ?? "", info.linedefined ?? 0, 0, 0];
        samples.set(key, entry);
      }
      if (level === 2) entry[3]++;
      if (!seen.has(key)) {
        entry[4]++;
        seen.add(key);
      }
    }
  }, "", SAMPLE_STEP);
  let started = os.clock();
  let heap = collectgarbage("count");
  const observe = (_state: unknown, frame: number) => {
    const elapsed = os.clock() - started;
    const allocated = collectgarbage("count") - heap;
    print(`frame\t${frame}\t${Math.floor(elapsed * 1000000)}\t${instructions}\t${Math.floor(allocated * 1024)}`);
    if (samples !== undefined) kept.push(samples);
    sampledFrame = frame + 1;
    samples = profiled.has(sampledFrame) ? new Map() : undefined;
    instructions = 0;
    heap = collectgarbage("count");
    started = os.clock();
  };
  const finish = () => {
    debug.sethook();
    const names = new Map<string, (this: void, line: number) => string>();
    for (const frame of kept) {
      for (const [sampled, source, line, self, inclusive] of frame.values()) {
        let name = names.get(source);
        if (name === undefined) {
          name = sourceNames(source);
          names.set(source, name);
        }
        print(`prof\t${sampled}\t${self}\t${inclusive}\t${name(line)}`);
      }
    }
  };
  return { observe, finish };
}

const path = os.getenv("REPLAY_FILE") ?? "";
const [file] = io.open(path, "r");
if (file === undefined) {
  print(`cannot open replay ${path}`);
  os.exit(1);
} else {
  const text = file.read("a") ?? "";
  file.close();
  const lines = text.split("\n").filter((line) => line.length > 0);
  const frames = os.getenv("PERF_PROFILE_FRAMES");
  const profiler = frames === undefined ? undefined : frameProfiler(frames);
  const result = replayMatch(lines, profiler?.observe);
  profiler?.finish();
  print(`frames ${result.frames} reached ${result.reached} recorded ${result.recorded} checksum ${result.checksum} digests ${result.digests} divergent ${result.divergent}`);
  for (const problem of result.problems) print(`problem ${problem}`);
}
