import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import { VERIFIED_STOCK_SOUNDS } from "../../generated/assets/stockSoundInfo";
import { AttackStyle, Character } from "../sim/codes";
import { IMPORTED_MURLOC_GURGLE } from "../assets/importedVoiceInfo";
import { murlocMoveVoices, presentationSoundPaths, readyVoice, warcryVoice } from "./matchAudio";
import { type MoveSoundSink, playPerform, specialMove } from "./moveSounds";

const TAKES = [1, 2, 3].map((take) => `Units\\Creeps\\Murloc\\MurlocYesAttack${take}.flac`);

function heard(move: number, serial: number): string[] {
  const files: string[] = [];
  const sink: MoveSoundSink = (file) => { files.push(file); };
  playPerform(Character.murloc, move, serial, sink);
  return files;
}

const voiced = (files: readonly string[]): string[] => files.filter((file) => file.includes("MurlocYesAttack"));

test("every Murloc move voice is a file the installed Warcraft III stores [k4 reference docs/design/murloc.md]", () => {
  assertEquals(murlocMoveVoices().join("|"), TAKES.join("|"));
  const preloaded = presentationSoundPaths([Character.murloc], []);
  assertTrue(TAKES.every((path) => VERIFIED_STOCK_SOUNDS[path] !== undefined));
  assertTrue(preloaded.includes(IMPORTED_MURLOC_GURGLE.path));
});

test("Murloc's entrance and victory voice are the imported gurgle, not a stock file [k2 property]", () => {
  assertEquals(readyVoice(Character.murloc), IMPORTED_MURLOC_GURGLE.path);
  assertEquals(warcryVoice(Character.murloc), IMPORTED_MURLOC_GURGLE.path);
  assertTrue(VERIFIED_STOCK_SOUNDS[IMPORTED_MURLOC_GURGLE.path] === undefined);
});

test("Murloc gurgles on two of three uses of his side and up specials and his smashes, across every take, and nowhere else [k2 property]", () => {
  for (const move of [specialMove(1), specialMove(2), AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.forwardSmash]) {
    const takes = new Set<string>();
    for (let serial = 0; serial < 9; serial++) {
      const voices = voiced(heard(move, serial));
      assertEquals(voices.length, imod(serial, 3) === 0 ? 0 : 1);
      for (const voice of voices) { assertTrue(TAKES.includes(voice)); takes.add(voice); }
    }
    assertEquals(takes.size, 3);
  }
  for (const move of [specialMove(0), specialMove(3), AttackStyle.jab, AttackStyle.forwardTilt]) {
    for (let serial = 0; serial < 9; serial++) assertEquals(voiced(heard(move, serial)).length, 0);
  }
});
