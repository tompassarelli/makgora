import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { FRIZ_QUADRATA_WIDTHS, textWidth } from "wisp/src/ui/chatLog";
import { PLAYABLE_CHARACTERS, fighterName } from "../roster/kits";
import { Character } from "../sim/codes";
import { NAME_PLATE_EMS, NAME_STEPS, fitName, fittedWidth, shrinkAt } from "./namePlate";

test("Every roster name fits the card's name plate at its fitted font, on at most two lines, never below 70% of the card font [k2 property]", () => {
  const names = PLAYABLE_CHARACTERS.map(character => fighterName(character));
  assertTrue(names.some(name => textWidth(name, FRIZ_QUADRATA_WIDTHS) > NAME_PLATE_EMS));
  for (const name of names) {
    const fitted = fitName(name);
    assertTrue(fitted.lines <= 2);
    assertTrue(fitted.shrink >= shrinkAt(NAME_STEPS));
    assertEquals(fitted.text.split("\n").join("").split(" ").join(""), name.split(" ").join(""));
    assertTrue(fittedWidth(fitted) <= NAME_PLATE_EMS);
  }
});

test("Mrgl & Grgl keeps one line on the plate at 95% of the card's font, and names that fit are left alone [k2 property]", () => {
  assertEquals(fighterName(Character.murloc), "Mrgl & Grgl");
  const duo = fitName("Mrgl & Grgl");
  assertEquals(duo.text, "Mrgl & Grgl");
  assertEquals(duo.lines, 1);
  assertEquals(duo.shrink, shrinkAt(1));
  const fitted = fitName("Anub'arak");
  assertEquals(fitted.text, "Anub'arak");
  assertEquals(fitted.shrink, 1.0);
  assertEquals(fitted.lines, 1);
});

test("A name wider than the plate shrinks, then takes a second line, and never loses a word [k2 property]", () => {
  const lady = fitName("Lady Vashj");
  assertEquals(lady.lines, 1);
  assertTrue(lady.shrink < 1.0 && lady.shrink >= f32(0.84));
  const long = fitName("Archimonde the Defiler");
  assertEquals(long.lines, 2);
  assertEquals(long.text.split("\n").join(" "), "Archimonde the Defiler");
});
