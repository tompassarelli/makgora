import { expect, test } from "bun:test";
import { NEUTRAL_INPUT, createStandaloneSession, stageNamed } from "../scripts/wisp/standalone";

const FRAMES = 240;
const DEPTH = 8;

async function digestsOf(rollback: number | undefined): Promise<{ readonly digests: string[]; readonly replayed: number; readonly stages: readonly string[] }> {
  const session = await createStandaloneSession({ fourFighters: true, stage: stageNamed("Blackrock"), ...(rollback === undefined ? {} : { rollback }) });
  const digests: string[] = [];
  try {
    for (let frame = 0; frame < FRAMES; frame++) {
      session.step(NEUTRAL_INPUT);
      const { frame: at, digest } = session.digest();
      digests.push(`${at} ${digest}`);
    }
    return { digests, replayed: session.replayed(), stages: Object.keys(session.stages?.() ?? {}) };
  } finally {
    session.close();
  }
}

test("a four-fighter match that runs its last 8 frames again after every step keeps every frame's digest [k1 scenario]", async () => {
  const straight = await digestsOf(undefined);
  const replayed = await digestsOf(DEPTH);
  expect(straight.replayed).toBe(0);
  expect(replayed.replayed).toBeGreaterThan((FRAMES - 2 * DEPTH - 60) * DEPTH);
  expect(replayed.stages).toEqual(["sim", "rollback"]);
  expect(replayed.digests).toEqual(straight.digests);
}, 180_000);

test("--stage reads a stage's name without case, spaces or punctuation and refuses one that names none [k2 property]", () => {
  expect(stageNamed("tomb-of-sargeras")).toBe(stageNamed("Tomb of Sargeras"));
  expect(stageNamed("NAXXRAMAS")).toBe(4);
  expect(() => stageNamed("Karazhan")).toThrow("--stage names no stage: Karazhan");
});
