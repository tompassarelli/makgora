import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { originalClip, originalClipNamed } from "../../generated/clips/fighterOriginalClipInfo";
import type { FighterOriginalClip } from "../../generated/clips/fighterOriginalClip";
import { Character } from "../sim/codes";
import { defeatClip, resultPoseAt, type ResultClips } from "./resultPose";

function named(character: number, name: string): FighterOriginalClip {
  const index = originalClipNamed(character, name);
  const clip = index === undefined ? undefined : originalClip(character, index);
  if (clip === undefined) throw new Error(`${character} has no ${name}`);
  return clip;
}

function resultClips(character: number): ResultClips {
  const stand = named(character, "stand");
  return { winnerClip: stand, repeatVictory: false, heldClip: stand, standClip: stand, defeatClip: defeatClip(character) };
}

test("a losing fighter whose look names a defeated sequence plays it once and holds its last frame, and one without stands idle [k2 property]", () => {
  const murloc = resultClips(Character.murloc);
  const death = named(Character.murloc, "death");
  assertEquals(murloc.defeatClip, death);
  const start = resultPoseAt(murloc, false, 0.0);
  assertEquals(start.clip, death);
  const offset = death.timeline === true ? death.startSeconds : 0.0;
  assertEquals(start.time, offset);
  const held = resultPoseAt(murloc, false, 60.0);
  assertEquals(held.clip, death);
  assertTrue(held.time > offset && held.time < offset + death.endSeconds - death.startSeconds);
  assertEquals(resultPoseAt(murloc, false, 90.0).time, held.time);

  const rifleman = resultClips(Character.rifleman);
  assertEquals(rifleman.defeatClip, undefined);
  assertEquals(resultPoseAt(rifleman, false, 0.0).clip, rifleman.standClip);
  assertEquals(resultPoseAt(rifleman, false, 60.0).clip, rifleman.standClip);
});
