import { expect, test } from "bun:test";
import { playedMoves } from "../../tools/animations/hd-models";
import { originalClipCount, originalClipNamed, originalClipNames } from "../src/game/assets/fighterOriginalClipInfo";
import { victoryAnimation } from "../src/game/presentation/matchAudio";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";

test("every fighter's Classic body carries its results-screen victory pose [k2 property]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const names = Array.from({ length: originalClipCount(character) }, () => "");
    for (const [name, index] of originalClipNames(character)) names[index] = name;
    const motion = { Sequences: names.map(Name => ({ Name })) } as unknown as Parameters<typeof playedMoves>[1];
    const victory = originalClipNamed(character, victoryAnimation(character));
    expect(victory, `${fighterName(character)} has no victory clip`).toBeDefined();
    expect(playedMoves(character, motion).classic, fighterName(character)).toContain(victory as number);
  }
});
