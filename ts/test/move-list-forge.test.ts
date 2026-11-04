import { expect, test } from "bun:test";
import { moveListMarkdown } from "../codegen/moveList";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/roster/kits";
import { isFeatured } from "../src/game/roster/forge";

test("the move list lists featured fighters first and every Forge fighter under In the Forge [k1 scenario]", () => {
  const text = moveListMarkdown();
  const forge = text.indexOf("\n# In the Forge\n");
  expect(forge).toBeGreaterThan(0);
  for (const character of SELECTABLE_CHARACTERS) {
    const at = text.indexOf(`\n## ${fighterName(character)}\n`);
    expect(at).toBeGreaterThan(0);
    expect(at > forge).toBe(!isFeatured(character));
  }
});
