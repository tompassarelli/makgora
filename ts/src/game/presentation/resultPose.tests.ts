import { assertEquals, test } from "wisp/src/runtime/testing";
import { originalClip, originalClipNamed } from "../../generated/clips/fighterOriginalClipInfo";
import type { FighterOriginalClip } from "../../generated/clips/fighterOriginalClip";
import { Character } from "../sim/codes";
import { defeatClip, resultBodies, resultPoseAt, type ResultClips } from "./resultPose";

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

test("a winning Murloc's duo partner is posed beside him as a winner playing the same victory in step, and a losing one as a loser [k2 property]", () => {
  const victory = named(Character.murloc, "murloc victory");
  const clips: ResultClips = { ...resultClips(Character.murloc), winnerClip: victory, repeatVictory: true };
  const partnerOf = (slot: number): number | undefined => (slot === 0 ? 2 : undefined);
  const bodies = resultBodies([{ slot: 0, winner: true }, { slot: 1, winner: false }], partnerOf);
  assertEquals(bodies.map(body => body.slot).join(","), "0,2,1");
  assertEquals(bodies.map(body => body.winner).join(","), "true,true,false");
  const [leader, partner] = bodies;
  if (leader === undefined || partner === undefined) throw new Error("no bodies");
  for (const seconds of [0.0, 0.25, 1.5]) {
    const mrgl = resultPoseAt(clips, leader.winner, seconds);
    const grgl = resultPoseAt(clips, partner.winner, seconds);
    assertEquals(mrgl.clip, victory);
    assertEquals(grgl.clip, mrgl.clip);
    assertEquals(grgl.time, mrgl.time);
  }
  const lost = resultBodies([{ slot: 0, winner: false }], partnerOf);
  assertEquals(lost.map(body => body.winner).join(","), "false,false");
  assertEquals(resultBodies([{ slot: 1, winner: true }], partnerOf).length, 1);
});
