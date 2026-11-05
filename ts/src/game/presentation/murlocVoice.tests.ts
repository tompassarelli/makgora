import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { VERIFIED_STOCK_SOUNDS } from "../../generated/assets/stockSoundInfo";
import { Character } from "../sim/codes";
import { IMPORTED_MURLOC_GURGLE } from "../assets/importedVoiceInfo";
import { murlocMoveVoices, presentationSoundPaths } from "./matchAudio";

const TAKES = [1, 2, 3].map((take) => `Units\\Creeps\\Murloc\\MurlocYesAttack${take}.flac`);

test("every Murloc move voice is a file the installed Warcraft III stores [k4 reference docs/design/murloc.md]", () => {
  assertEquals(murlocMoveVoices().join("|"), TAKES.join("|"));
  const preloaded = presentationSoundPaths([Character.murloc], []);
  assertTrue(TAKES.every((path) => VERIFIED_STOCK_SOUNDS[path] !== undefined));
  assertTrue(preloaded.includes(IMPORTED_MURLOC_GURGLE.path));
});
