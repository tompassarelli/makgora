import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { ILLUSION_FIRST_TRAVEL_FRAME } from "../sim/specials/illusionDash";
import { WARDEN_SPECIALS } from "../fighters/warden/specials";
import { HERO_CUES } from "./specialCues";
import { heroCueWindows } from "./cueWindows";
import { moveSound, soundFiles, specialMove } from "./moveSounds";
import { createFighter } from "../sim/fighter";
import { duelPair, stepDuel } from "../sim/testDuel";
import { controls } from "../sim/testWorld";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "./impactEvents";
import { presentImpactSounds, presentStartSounds } from "./hitPresentation";

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

const sidePress = controls({ specialPressed: true, specialX: 1, specialHeld: true });

function pressSide(character: Character): { readonly started: number; readonly start: { readonly sound: string; readonly volume: number }[]; readonly following: string[] } {
  const fighter = createFighter(character, 0.0, 1);
  const { world } = duelPair(fighter, createFighter(Character.rifleman, 900.0, -1));
  const events = createImpactEvents();
  for (let frame = 1; frame <= 3; frame++) {
    captureImpactEventsBefore(events, fighter);
    stepDuel(world, frame === 1 ? sidePress : controls());
    finishImpactEventsAfter(events, fighter, world);
    const start: { sound: string; volume: number }[] = [];
    const following: string[] = [];
    presentStartSounds(events, (sound, _x, _z, volume) => { start.push({ sound, volume }); });
    presentImpactSounds(events, (sound) => { following.push(sound); });
    if (start.length > 0) return { started: frame, start, following };
  }
  return { started: -1, start: [], following: [] };
}

test("Shadow Dash and Fel Rush queue their start sound on the press frame, through the start pass a predicted frame plays, never the confirmed pass [k1 scenario]", () => {
  for (const character of [Character.warden, Character.demonHunter]) {
    const { started, start, following } = pressSide(character);
    assertEquals(started, 1);
    const files = moveSound(character, SIDE)?.perform.flatMap((layer) => layer.sounds.flatMap((sound) => soundFiles(sound))) ?? [];
    assertTrue(start.length > 0 && start.every((played) => files.includes(played.sound)));
    assertTrue(following.every((sound) => !files.includes(sound)));
  }
  const maiev = pressSide(Character.warden).start;
  assertTrue(soundFiles("MetalHeavySliceMetal").includes(maiev[0]?.sound ?? ""));
  assertEquals(maiev[0]?.volume, 127);
});
