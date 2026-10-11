import { expect, test } from "bun:test";

test("exact native report boundary keeps installed map through injected gate failure [k5 boundary green-native-install]", async () => {
  const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createHash } = await import("node:crypto");
  const { Effect } = await import("effect");
  const { installAcceptedGreen } = await import("./wisp/installGreen");
  const { GREEN_GATE_CHECKS, GREEN_GATE_LOOKS } = await import("./wisp/greenBuilds");
  const root = mkdtempSync(join(tmpdir(), "smashcraft-green-gate-"));
  try {
    const documents = join(root, "documents");
    const library = join(documents, "Maps/00-Smashcraft");
    const state = join(root, "state");
    mkdirSync(library, { recursive: true });
    const previous = join(library, "Smashcraft 0.0.133 9f0b248.w3x");
    writeFileSync(previous, "last good map");
    const map = join(root, "Smashcraft 0.0.134 aaaaaaa.w3x");
    writeFileSync(map, "exact candidate bytes");
    const hash = createHash("sha256").update(readFileSync(map)).digest("hex");
    const reports = GREEN_GATE_LOOKS.map(graphicsLook => ({ candidateMapSha256: hash, graphicsLook: String(graphicsLook),
      results: GREEN_GATE_CHECKS.map(id => ({ id, verdict: "pass", reason: "native measurement passed" })) }));
    const save = () => reports.forEach((report, index) => {
      const folder = join(state, "accept", hash, GREEN_GATE_LOOKS[index]!);
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "report.json"), JSON.stringify(report));
    });
    const install = () => Effect.runPromise(installAcceptedGreen(documents, map, "a".repeat(40), GREEN_GATE_CHECKS, state).pipe(Effect.result));
    const candidate = join(library, "Smashcraft 0.0.134 aaaaaaa.w3x");
    const blocked = async () => {
      expect((await install())._tag).toBe("Failure");
      expect(existsSync(candidate)).toBe(false);
      expect(readFileSync(previous, "utf8")).toBe("last good map");
      expect(["blocked", "pending-native"]).toContain(JSON.parse(readFileSync(join(state, "status.json"), "utf8")).state);
    };
    await blocked();
    for (const verdict of ["fail", "needs-look"]) {
      reports[0]!.results[0]!.verdict = verdict;
      save();
      await blocked();
      expect(readFileSync(join(state, "status.json"), "utf8")).toContain(GREEN_GATE_CHECKS[0]);
    }
    reports[0]!.results[0]!.verdict = "pass";
    reports[0]!.candidateMapSha256 = "b".repeat(64);
    save();
    await blocked();
    reports[0]!.candidateMapSha256 = hash;
    const result = reports[0]!.results.pop()!;
    save();
    await blocked();
    reports[0]!.results.push(result);
    reports[0]!.graphicsLook = "definitive";
    save();
    await blocked();
    reports[0]!.graphicsLook = "classic";
    save();
    expect((await Effect.runPromise(installAcceptedGreen(documents, map, "a".repeat(40), [], state).pipe(Effect.result)))._tag).toBe("Failure");
    save();
    expect((await Effect.runPromise(installAcceptedGreen(documents, map, "a".repeat(40), [...GREEN_GATE_CHECKS, "gate-additional-native-measurement"], state).pipe(Effect.result)))._tag).toBe("Failure");
    expect(existsSync(candidate)).toBe(false);
    expect((await install())._tag).toBe("Success");
    expect(readFileSync(candidate, "utf8")).toBe("exact candidate bytes");
    expect(readFileSync(previous, "utf8")).toBe("last good map");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
