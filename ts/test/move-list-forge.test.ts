import { expect, test } from "bun:test";
import { moveListMarkdown } from "../codegen/moveList";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/roster/kits";
import { isComingSoon, isFeatured } from "../src/game/roster/forge";

test("the move list lists featured fighters first, every playable Forge fighter under In the Forge and every coming-soon fighter by name under Coming soon [k1 scenario]", () => {
  const text = moveListMarkdown();
  const forge = text.indexOf("\n# In the Forge\n");
  const comingSoon = text.indexOf("\n## Coming soon\n");
  expect(forge).toBeGreaterThan(0);
  for (const character of SELECTABLE_CHARACTERS) {
    const at = text.indexOf(`\n## ${fighterName(character)}\n`);
    if (isComingSoon(character)) {
      expect(at).toBe(-1);
      expect(comingSoon).toBeGreaterThan(forge);
      expect(text.indexOf(`\n- ${fighterName(character)}\n`, comingSoon)).toBeGreaterThan(comingSoon);
      continue;
    }
    expect(at).toBeGreaterThan(0);
    expect(at > forge).toBe(!isFeatured(character));
  }
});
