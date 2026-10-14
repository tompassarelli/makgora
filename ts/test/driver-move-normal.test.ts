import { expect, test } from "bun:test";
import { createStandaloneSession, NEUTRAL_INPUT } from "../scripts/wisp/standalone";
import { shell } from "../src/platform/shell/state";
import { clipFor } from "../src/game/presentation/fighterClips";
import { Character } from "../src/game/sim/codes";

for (const [code, pose] of [[2, "upSmash"], [12, "neutralAir"]] as const) {
  test(`scripted move normal ${code} plays the Forsaken Paladin ${pose} clip [k1 scenario]`, async () => {
    const script = `#! chat -dev quick hero forsaken paladin\n40 a move normal ${code} right\n44 a capture\n`;
    const session = await createStandaloneSession({ presentation: "pool-confirmed", script });
    try {
      while (session.frame() < 44) session.step(NEUTRAL_INPUT);
      let clip: number | undefined;
      session.client.run(() => { clip = shell().runtime.poses[0]?.clipIndex; });
      expect(clip).toBe(clipFor(Character.forsakenPaladin, pose).index);
    } finally { session.close(); }
  }, 60000);
}
