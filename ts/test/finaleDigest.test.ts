import { expect, test } from "bun:test";
import { finale } from "../src/host/loop/finale";
import { NEUTRAL_INPUT, createStandaloneSession } from "../scripts/wisp/standalone";

const MATCH_FRAME_LIMIT = 20000;
const RESULT_FRAMES = 480;

async function digestsOf(closingShots: boolean): Promise<{ readonly digests: string[]; readonly zoom: number; readonly orbit: number }> {
  finale.koZoom = closingShots;
  finale.orbit = closingShots;
  finale.zoomFramesShown = 0;
  finale.orbitFramesShown = 0;
  const session = await createStandaloneSession({ start: "results" });
  const digests: string[] = [];
  try {
    let frames = 0;
    while (!session.finished() && frames++ < MATCH_FRAME_LIMIT) {
      session.step(NEUTRAL_INPUT);
      digests.push(session.digest().digest);
    }
    for (let frame = 0; frame < RESULT_FRAMES; frame++) {
      session.step(NEUTRAL_INPUT);
      digests.push(session.digest().digest);
    }
  } finally {
    session.close();
  }
  return { digests, zoom: finale.zoomFramesShown, orbit: finale.orbitFramesShown };
}

test("the final-KO zoom and the victory orbit leave every frame's state digest as it was [k1 scenario]", async () => {
  const off = await digestsOf(false);
  const on = await digestsOf(true);
  finale.koZoom = true;
  finale.orbit = true;
  expect(off.zoom + off.orbit).toBe(0);
  expect(on.zoom).toBeGreaterThan(0);
  expect(on.orbit).toBeGreaterThan(0);
  expect(on.digests).toEqual(off.digests);
}, 120_000);
