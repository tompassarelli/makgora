import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { ILLUSION_FIRST_TRAVEL_FRAME } from "../sim/specials/illusionDash";
import { WARDEN_SPECIALS } from "../fighters/warden/specials";
import { HERO_CUES } from "./specialCues";
import { heroCueWindows } from "./cueWindows";
import { moveSound, soundFiles, specialMove } from "./moveSounds";

const SIDE = specialMove(1);

test("Shadow Dash holds a Night Elf body tell through the 20 still frames and plays its own sound on the first, apart from Fel Rush's [k2 property]", () => {
  const { startup } = heroCueWindows(WARDEN_SPECIALS.side.ground);
  assertEquals(startup.first, 1);
  assertTrue(startup.last >= ILLUSION_FIRST_TRAVEL_FRAME - 1);
  const tell = HERO_CUES[Character.warden]?.side.startup;
  assertEquals(tell?.anchor, "body");
  assertTrue(tell?.model.includes("NightElf") === true);
  const maiev = moveSound(Character.warden, SIDE);
  const illidan = moveSound(Character.demonHunter, SIDE);
  const startFiles = maiev?.perform.flatMap((layer) => layer.sounds.flatMap((sound) => soundFiles(sound))) ?? [];
  assertTrue(startFiles.length > 0);
  const felFiles = illidan?.perform.flatMap((layer) => layer.sounds.flatMap((sound) => soundFiles(sound))) ?? [];
  assertTrue(startFiles.every((file) => !felFiles.includes(file)));
  assertTrue((maiev?.impact.length ?? 0) > 0 && (maiev?.hit.length ?? 0) > 0);
});
