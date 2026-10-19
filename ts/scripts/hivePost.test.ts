import { expect, test } from "bun:test";
import { hiveBbcode } from "./hivePost";

test("a Markdown post becomes Hive BBCode with a centred title, sized headings, both list kinds, links, bold and code [k1 scenario]", () => {
  const markdown = [
    "# Smashcraft 0.1.1",
    "*A platform fighter*",
    "",
    "**Pick a hero.** Then fight.",
    "",
    "## How to play",
    "1. Download **Smashcraft 0.1.1.w3x**.",
    "2. Open [Issues](https://github.com/tompassarelli/smashcraft/issues).",
    "",
    "### Looks",
    "- Saves to `smashcraft-repro-*.txt` in *CustomMapData*",
    "",
  ].join("\n");
  expect(hiveBbcode(markdown)).toBe([
    "[CENTER][SIZE=6][B]Smashcraft 0.1.1[/B][/SIZE]",
    "[I]A platform fighter[/I]",
    "",
    "[/CENTER]",
    "",
    "[B]Pick a hero.[/B] Then fight.",
    "",
    "[SIZE=5][B]How to play[/B][/SIZE]",
    "[LIST=1]",
    "[*]Download [B]Smashcraft 0.1.1.w3x[/B].",
    "[*]Open [URL=\"https://github.com/tompassarelli/smashcraft/issues\"]Issues[/URL].",
    "[/LIST]",
    "",
    "[B]Looks[/B]",
    "[LIST]",
    "[*]Saves to [I]smashcraft-repro-*.txt[/I] in [I]CustomMapData[/I]",
    "[/LIST]",
    "",
  ].join("\n"));
});
