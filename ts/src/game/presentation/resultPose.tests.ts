import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import type { FighterOriginalClip } from "../../generated/clips/fighterOriginalClip";
import { resultPoseAt, type ResultClips } from "./resultPose";

const clip = (startSeconds: number, endSeconds: number): FighterOriginalClip => ({ modelPath: "body.mdx", timeline: true, startSeconds, endSeconds, looping: false });

test("the loser rests in its knockdown's downed frame on every results frame while the winner plays its victory from the start [k2 property]", () => {
  const clips: ResultClips = { winnerClip: clip(10.0, 11.5), repeatVictory: true, heldClip: clip(2.0, 3.0), defeatedClip: clip(40.0, 41.5), defeatedSeconds: 0.5 };
  for (let frame = 1; frame <= 600; frame++) {
    const seconds = frame / 60.0;
    const lost = resultPoseAt(clips, false, seconds);
    assertEquals(lost.clip, clips.defeatedClip, `frame ${frame}: the loser shows its knockdown`);
    assertEquals(Math.abs(lost.time - 40.5) < f32(1e-6), true, `frame ${frame}: the loser holds ${lost.time}, not its downed frame`);
    const won = resultPoseAt(clips, true, seconds);
    assertEquals(won.clip, clips.winnerClip, `frame ${frame}: the winner shows its victory`);
    assertEquals(won.time >= 10.0 && won.time < 11.5, true, `frame ${frame}: the winner's time ${won.time} lies inside its victory`);
  }
  assertEquals(Math.abs(resultPoseAt(clips, true, 1.0 / 60.0).time - (10.0 + 1.0 / 60.0)) < f32(1e-6), true, "the victory starts from its first frame");
});
